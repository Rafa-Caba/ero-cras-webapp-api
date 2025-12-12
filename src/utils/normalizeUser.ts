import type { IUser } from '../models/User';
import type { Document } from 'mongoose';

export const normalizeUserWithChoir = (user: IUser & Document) => {
    const userJson: any = user.toJSON();

    let choirIdString: string | undefined = undefined;
    let choirName: string | undefined = undefined;
    let choirCode: string | undefined = undefined;

    if (user.choirId) {
        const choirAny = user.choirId as any;

        if (typeof choirAny === 'object' && choirAny !== null) {
            choirIdString =
                choirAny.id ??
                (choirAny._id ? choirAny._id.toString() : undefined);
            choirName = choirAny.name;
            choirCode = choirAny.code;
        } else {
            choirIdString = user.choirId.toString();
        }
    }

    if (choirIdString) userJson.choirId = choirIdString;
    if (choirName) userJson.choirName = choirName;
    if (choirCode) userJson.choirCode = choirCode;

    return userJson;
};
