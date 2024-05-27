const { BadrequestError } = require('../../common/core/error.response');
const { Schedule, Member } = require('./schedule.model');
const { createScheduleJoi, updateScheduleJoi } = require('./schedule.validate.js');
const { compareDays, ltOrEqDays, getStatusByTime, isLessThanDays, isGreaterThanDays, formatVNDate } = require('../../common/utils/date.util');
const User = require('../user/user.model.js');
const { toObjectId, getUnSelectData } = require('../../common/utils/object.util.js');
const { getUserSettings } = require('../user/user.repo.js');
const { orderBy } = require('lodash');
const conversationModel = require('../chat/conversation/conversation.model.js');
const { scheduleJob } = require('../node-schedule/scheduleJob.js');


const getAll = async (userId, tab) => {
    try {
        const baseQuery = {
            isActive: true,
            $or: [
                { ownerId: userId },
                { 'members.memberId': userId }
            ]
        };

        const currentDate = new Date();

        switch (tab) {
            case 'upcoming':
                baseQuery.startDate = { $gte: currentDate };
                break;
            case 'completed':
                baseQuery.endDate = { $lt: currentDate };
                break;
            case 'in_progress':
                baseQuery.startDate = { $lte: currentDate };
                baseQuery.endDate = { $gte: currentDate };
                break;
        }

        const [schedules, groupChats] = await Promise.all([
            Schedule.find(baseQuery)
                .populate({
                    path: 'members.memberId',
                    select: 'name email avatar'
                })
                .select('topic imageUrl ownerId members startDate endDate')
                .lean(),
            conversationModel.find({ type: 'group' }).select('_id').lean()
        ]);

        const groupChatIds = new Set(groupChats.map(chat => chat._id.toString()));

        const formattedSchedules = schedules.map(schedule => {
            const isExistGroupChat = groupChatIds.has(schedule._id.toString());
            const formattedMembers = schedule.members.map(member => ({
                ...member.memberId,
                permission: member.permission,
                isActive: member.isActive
            }));
            const isOwner = schedule.ownerId.toString() === userId;
            schedule.members = formattedMembers;
            schedule.isOwner = isOwner;
            schedule.permission = isOwner ? 'edit' : formattedMembers.find(member => member._id.toString() === userId)?.permission;
            schedule.canCreateGroupChat = !isExistGroupChat && schedule.members.length >= 1;
            return schedule;
        });

        return formattedSchedules;
    } catch (error) {
        throw new BadRequestError(`Failed to retrieve schedules: ${error.message}`);
    }
};

const getUserCalendar = async (userId) => {
    try {
        const schedules = await Schedule.find(
            { isActive: true, ownerId: userId },
            { _id: 1, plans: 1 }
        ).exec();

        const calendars = schedules.flatMap(schedule =>
            schedule.plans.map(plan => ({
                id: schedule._id.toString(),
                title: plan.title,
                start: plan.startAt,
                end: plan.endAt
            }))
        );

        return calendars;
    } catch (error) {
        throw new BadRequestError(`Get user calendar failed: ${error.message}`);
    }
};

const getById = async (scheduleId) => {
    try {
        const schedule = await Schedule.findById(scheduleId).populate({
            path: 'members.memberId',
            select: 'name email avatar'
        }).lean();

        schedule.members = schedule.members.map(member => ({
            ...member.memberId
        }));
        return schedule
    } catch (error) {
        throw new BadrequestError('Get schedule by id failed')
    }
}

const getMemberList = async (members) => {
    try {
        const memberList = await Promise.all(members.map(async (member) => {
            const scheduleMember = await User.findById(toObjectId(member.memberId))
                .select(getUnSelectData(['__v', 'createdAt', 'updatedAt', 'password', 'providerAccountId', 'provider', 'isActive', 'authType', 'socketId']))
            return scheduleMember
        }));

        return memberList ? memberList : []
    } catch (error) {
        throw new BadrequestError('Get member list failed')
    }
}

const create = async (schedule) => {
    try {
        const { error, value } = createScheduleJoi.validate(schedule);
        if (error) {
            throw new BadrequestError(error.details[0].message);
        }

        if (compareDays(value.startDate, new Date())) {
            value.status = 'in_progress';
        }

        if (value.plans && value.plans.length > 0) {
            value.plans = value.plans.map((plan, index, plans) => {
                if (index < plans.length - 1) {
                    plan.endAt = plans[index + 1].startAt;
                } else {
                    plan.endAt = value.endDate;
                }
                return plan;
            });
        }

        const newSchedule = await Schedule.create(value);
        scheduleJob(newSchedule);
        return newSchedule;
    } catch (error) {
        console.log("🚀 ~ create ~ error:::", error);
        throw new BadrequestError('Create new schedule failed');
    }
};

const update = async (schedule) => {
    const { _id, ...payload } = schedule;
    try {
        const { error, value } = updateScheduleJoi.validate(payload);
        if (error) {
            throw new BadrequestError(error.message);
        }

        const updatedSchedule = await Schedule.findOneAndUpdate({ _id }, value, { new: true });
        if (payload?.startDate && payload.startDate !== updatedSchedule?.startDate) {
            scheduleJob(updatedSchedule);
        }
        return updatedSchedule;
    } catch (error) {
        throw new BadrequestError('Update schedule failed')
    }
}

const addFriendToSchedule = async ({ friendId, scheduleId }) => {
    try {
        await Member.create({
            memberId: friendId,
            scheduleId
        })
    } catch (error) {
        throw new BadrequestError('Add member to schedule failed')
    }
}

const editPermission = async ({ memberId, scheduleId, permission }) => {
    try {
        const updatedSchedule = await Schedule.findOneAndUpdate(
            {
                _id: toObjectId(scheduleId),
                'members.memberId': toObjectId(memberId)
            },
            { $set: { 'members.$[member].permission': permission } },
            { arrayFilters: [{ 'member.memberId': toObjectId(memberId) }], new: true }
        );
        console.log("🚀 ~ editPermission ~ updatedSchedule:::", updatedSchedule);

        return updatedSchedule;
    } catch (error) {
        throw new BadrequestError('Update permissions failed')
    }
}

const getDetailSchedule = async (scheduleId, userId) => {
    try {
        const currentDate = new Date();
        const [schedule, isExistGroupChat] = await Promise.all([
            Schedule.findById(scheduleId)
                .populate({
                    path: 'members.memberId',
                    select: 'name email avatar'
                })
                .lean(),
            conversationModel.exists({ type: 'group', _id: scheduleId })
        ]);

        if (!schedule) {
            throw new BadRequestError('Schedule not found');
        }

        schedule.plans = orderBy(schedule.plans, ['startAt'], ['asc']);

        // Format plans and set status
        const formatPlans = schedule.plans.map(plan => {
            let status;
            if (isLessThanDays(plan.startAt, currentDate)) {
                status = 'done';
            } else if (isGreaterThanDays(plan.startAt, currentDate)) {
                status = 'in_coming';
            } else {
                status = getStatusByTime(plan.startAt, plan.endAt);
            }
            return { ...plan, status };
        });

        // Calculate schedule progress
        const countDoneSchedule = formatPlans.filter(plan => plan.status === 'done').length;
        const progress = {
            percent: Math.round((countDoneSchedule / schedule.plans.length) * 100),
            part: `${countDoneSchedule} / ${schedule.plans.length}`
        };

        // Format members list
        const formattedMembers = schedule.members.map(member => ({
            ...member.memberId,
            permission: member.permission,
            isActive: member.isActive
        }));

        // Get owner info
        const owner = await getUserSettings(schedule.ownerId);
        const isOwner = schedule.ownerId.toString() === userId;
        const userPermission = formattedMembers.find(member => member._id.toString() === userId)?.permission;

        schedule.plans = formatPlans;
        schedule.progress = progress;
        schedule.members = formattedMembers;
        schedule.isOwner = isOwner;
        schedule.permission = isOwner ? 'edit' : userPermission;
        schedule.canCreateGroupChat = !isExistGroupChat && schedule.members.length >= 1;
        schedule.members.unshift(owner);

        return schedule;
    } catch (error) {
        throw new BadRequestError(`Get detail schedule failed: ${error.message}`);
    }
};

const deleteSchedule = async (scheduleId) => {
    try {
        const deletedSchedule = await Schedule.findOneAndDelete({ _id: scheduleId });
        return deletedSchedule;
    } catch (error) {
        throw new BadrequestError('Delete schedule failed')
    }
}

module.exports = {
    create, update, addFriendToSchedule, editPermission,
    getAll, getById, getUserCalendar, getDetailSchedule, deleteSchedule
};
