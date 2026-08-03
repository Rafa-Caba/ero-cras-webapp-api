// src/controllers/member.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import Member, { type IMember } from '../models/Member';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseMemberInput } from '../validations/schemas/resource.schemas';

interface ResourceParams {
    readonly id: string;
}

const findMember = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IMember> => {
    return Member
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'MEMBER_NOT_FOUND',
            'Member not found'
        ))
        .exec();
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
    res.json(members);
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
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const memberId = new Types.ObjectId();
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'MEMBER',
            category: 'members'
        })
        : null;

    const member = await Member.create({
        _id: memberId,
        ...input,
        instrumentId: input.instrumentId
            ? parseObjectId(input.instrumentId, 'instrumentId')
            : null,
        imageUrl: uploaded?.media.url ?? '',
        imagePublicId: uploaded?.media.publicId ?? null,
        imageResourceType: uploaded?.media.resourceType ?? null,
        imageAssetId: uploaded?.asset._id ?? null,
        choirId,
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Member creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'MEMBER', member._id);
    }

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
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const member = await findMember(req.params.id, choirId);
    const before = member.toObject();
    const input = parseMemberInput(req);
    const previousAssetId = member.imageAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'MEMBER',
            category: 'members'
        })
        : null;

    member.name = input.name;
    member.instrumentId = input.instrumentId
        ? parseObjectId(input.instrumentId, 'instrumentId')
        : null;
    member.instrumentLabel = input.instrumentLabel;
    member.voice = input.voice;
    member.updatedBy = actorUserId;

    if (uploaded) {
        member.imageUrl = uploaded.media.url;
        member.imagePublicId = uploaded.media.publicId;
        member.imageResourceType = uploaded.media.resourceType;
        member.imageAssetId = uploaded.asset._id;
    }

    await member.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Member update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'MEMBER', member._id);
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'MEMBER',
            ownerId: member._id
        });
    }

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
    const choirId = requireEffectiveChoirObjectId(req);
    const member = await findMember(req.params.id, choirId);
    const before = member.toObject();
    const assetId = member.imageAssetId;
    await member.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'MEMBER',
        ownerId: member._id
    });

    await registerLog({
        req,
        collection: 'Members',
        action: 'delete',
        referenceId: member.id,
        changes: { before }
    });

    res.json({ message: 'Member deleted successfully' });
};
