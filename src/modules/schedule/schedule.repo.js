const { toObjectId, getUnSelectData } = require('../../common/utils');
const { BadrequestError } = require('../../common/core/error.response');
const { Schedule, Member } = require('./schedule.model');
const { createScheduleJoi, updateScheduleJoi } = require('./schedule.util');


const create = async (schedule) => {
    try {
        const { error, value } = createScheduleJoi.validate(schedule);
        console.log("🚀 ~ create ~ value:::", value);
        if (error) {
            throw new BadrequestError(error.message);
        }

        const newSchedule = await Schedule.create(value);
        return newSchedule;
    } catch (error) {
        throw new BadrequestError('Create new schedule failed')
    }
}

const update = async (schedule) => {
    try {
        const { error, value } = updateScheduleJoi.validate(schedule);
        console.log("🚀 ~ create ~ value:::", value);
        if (error) {
            throw new BadrequestError(error.message);
        }

        const updatedSchedule = await Schedule.findByIdAndUpdate(schedule._id, {
            value
        });
        return updatedSchedule;
    } catch (error) {
        console.log("🚀 ~ create ~ error:::", error);
        throw new BadrequestError('Create new schedule failed')
    }
}

const addFriendToSchedule = async ({ friendId, scheduleId }) => {
    try {
        await Member.create({
            memberId: friendId,
            scheduleId
        })
    } catch (error) {
        throw new BadrequestError('Add member toschedule failed')
    }
}

const editPermissions = async ({ friendId, scheduleId }) => {
    try {
        const query = {
            memberId: friendId,
            scheduleId
        }
        const bodyUpdate = { $set: { 'members.$.permission': permission } }
        const updatedSchedule = await Member.findOneAndUpdate(
            query,
            { $set: { 'members.$.permission': permission } },
            bodyUpdate,
            { new: true }
        );

        if (!updatedSchedule) {
            throw new BadRequestError('Schedule or member not found');
        }
        return updatedSchedule;
    } catch (error) {
        throw new BadrequestError('Update permissions failed')
    }
}

module.exports = {
    create, update, addFriendToSchedule, editPermissions
};
