// src/controllers/member.controller.ts

import type { Request, Response } from 'express';
import { deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import Member, { type IMember } from '../models/Member';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { resolvePublicChoirId } from '../services/publicChoir.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import { parseMemberInput } from '../validations/schemas/resource.schemas';
import { parseObjectId } from '../validations/schemas/common.schemas';

interface ResourceParams {
    readonly id: string;
    readonly choirKey?: string;
}

const findMember = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IMember> => {
    return Member
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'MEMBER_NOT_FOUND',
                'Member not found'
            )
        )
        .exec();
};

export const listPublicMembersController = async (
    req: Request<ResourceParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const members = await Member.find({ choirId })
        .select('-imagePublicId -updatedBy')
        .populate('instrumentId', 'name slug iconKey iconUrl')
        .sort({ name: 1 });
    res.json({ members });
};

export const listMembersController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const members = await Member.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('instrumentId', 'name slug iconKey iconUrl')
        .sort({ name: 1 });
    res.json({ members });
};

export const getMemberController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const member = await findMember(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    await member.populate('instrumentId', 'name slug iconKey iconUrl');
    res.json(member);
};

export const createMemberController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseMemberInput(req);
    const member = await Member.create({
        ...input,
        instrumentId: input.instrumentId
            ? parseObjectId(input.instrumentId, 'instrumentId')
            : null,
        imageUrl: req.file?.path ?? '',
        imagePublicId: req.file?.filename ?? null,
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

    await registerLog({
        req,
        collection: 'Members',
        action: 'create',
        referenceId: member.id,
        changes: { after: member.toObject() }
    });

    res.status(201).json(member);
};

export const updateMemberController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const member = await findMember(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = member.toObject();
    const input = parseMemberInput(req);

    if (req.file) {
        await deleteFromCloudinary(member.imagePublicId ?? '');
        member.imageUrl = req.file.path;
        member.imagePublicId = req.file.filename;
    }

    member.name = input.name;
    member.instrumentId = input.instrumentId
        ? parseObjectId(input.instrumentId, 'instrumentId')
        : null;
    member.instrumentLabel = input.instrumentLabel;
    member.voice = input.voice;
    member.updatedBy = requireAuthenticatedUserId(req);
    await member.save();

    await registerLog({
        req,
        collection: 'Members',
        action: 'update',
        referenceId: member.id,
        changes: { before, after: member.toObject() }
    });

    res.json(member);
};

export const deleteMemberController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const member = await findMember(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = member.toObject();
    await deleteFromCloudinary(member.imagePublicId ?? '');
    await member.deleteOne();

    await registerLog({
        req,
        collection: 'Members',
        action: 'delete',
        referenceId: member.id,
        changes: { before }
    });

    res.json({ message: 'Member deleted successfully' });
};
