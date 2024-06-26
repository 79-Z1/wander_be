'use strict';

const { BadrequestError } = require("../../common/core/error.response");
const { logger } = require("../../common/helpers/logger");
const { handleObject } = require("../../common/utils");
const { createUser, searchUsersByName, getUserProfile, getUserSettings, updateUser, suggestFriends, updateUserLocation } = require("./user.repo");


class UserService {

    static create = async ({ name, password = '', email, ...rest }) => {
        if (!name) throw new BadrequestError('Name is required');
        if (!email) throw new BadrequestError('Email is required');

        logger.info(
            `UserService -> create [START]\n(INPUT) ${handleObject({ name, password, email, ...rest })
            }`
        )

        const user = await createUser({ name, password, email, ...rest })
        if (!user) throw new BadrequestError('Create user failed');

        logger.info(
            `UserService -> create [END]\n(OUTPUT) ${handleObject({ user })
            }`
        )
        return user;
    }

    static getUserProfile = async (userId, friendId) => {
        logger.info(
            `UserService -> getUserProfile [START]\n(INPUT) ${handleObject({ userId, friendId })
            }`
        )
        if (!friendId) throw new BadrequestError('Friend id is required');

        const profile = await getUserProfile(userId, friendId)
        logger.info(
            `UserService -> getUserProfile [END]\n(OUTPUT) ${handleObject({ profile })
            }`
        )
        return profile
    }

    static searchUsersByName = async name => {
        if (!name) throw new BadrequestError('Name is required');

        logger.info(
            `UserService -> searchUsersByName [START]\n(INPUT) ${handleObject({ name })
            }`
        )

        const users = await searchUsersByName(name)

        logger.info(
            `UserService -> searchUsersByName [END]\n(OUTPUT) ${handleObject({ users })
            }`
        )
        return users;
    }

    static getUserSettings = async (userId) => {
        logger.info(
            `UserService -> getUserSettings [START]\n(INPUT) ${handleObject({ userId })
            }`
        )
        const settings = await getUserSettings(userId)
        logger.info(
            `UserService -> getUserSettings [END]\n(OUTPUT) ${handleObject({ settings })
            }`
        )
        return settings
    }

    static updateUser = async (userId, data) => {
        logger.info(
            `UserService -> updateUser [START]\n(INPUT) ${handleObject({ userId, data })
            }`
        )
        const user = await updateUser(userId, data)
        logger.info(
            `UserService -> updateUser [END]\n(OUTPUT) ${handleObject({ user })
            }`
        )
        return user
    }

    static suggestFriends = async (userId) => {
        logger.info(
            `AdminService -> suggestFriends [START]\n(INPUT) ${handleObject({ userId })}`
        )
        const users = await suggestFriends(userId);
        logger.info(
            `AdminService -> suggestFriends [END]\n(OUTPUT) ${handleObject({ users })}`
        )
        return users ?? [];
    }

    static updateUserLocation = async (userId, location) => {
        logger.info(
            `UserService -> updateUserLocation [START]\n(INPUT) ${handleObject({ userId, location })}`
        )
        const user = await updateUserLocation(userId, location)
        logger.info(
            `UserService -> updateUserLocation [END]\n(OUTPUT) ${handleObject({ user })}`
        )
        return !!user ?? false;
    }
}

module.exports = UserService;
