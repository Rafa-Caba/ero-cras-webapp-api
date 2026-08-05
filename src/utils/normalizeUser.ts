// src/utils/normalizeUser.ts

import type { Types } from 'mongoose';
import type { IUser } from '../models/User';

interface PopulatedChoirReference {
    readonly _id: Types.ObjectId;
    readonly id?: string;
    readonly name?: string;
    readonly code?: string;
}

type ChoirReference = Types.ObjectId | PopulatedChoirReference;
type UserWithChoirReference = Omit<IUser, 'choirId'> & {
    readonly choirId?: ChoirReference | null;
};

const isPopulatedChoir = (
    choir: ChoirReference
): choir is PopulatedChoirReference => {
    return 'name' in choir || 'code' in choir;
};

export const normalizeUserWithChoir = (user: UserWithChoirReference) => {
    const userJson = user.toJSON();
    const choir = user.choirId;

    if (!choir) {
        return {
            ...userJson,
            choirId: null
        };
    }

    if (isPopulatedChoir(choir)) {
        return {
            ...userJson,
            choirId: choir.id ?? choir._id.toString(),
            ...(choir.name ? { choirName: choir.name } : {}),
            ...(choir.code ? { choirCode: choir.code } : {})
        };
    }

    return {
        ...userJson,
        choirId: choir.toString()
    };
};
