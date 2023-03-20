/*
	Fosscord: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Fosscord and Fosscord Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
	emitEvent,
	GuildStickersUpdateEvent,
	Member,
	Snowflake,
	Sticker,
	StickerFormatType,
	StickerType,
	uploadFile,
	ModifyGuildStickerSchema,
} from "@fosscord/util";
import { Router, Request, Response } from "express";
import { route } from "@fosscord/api";
import multer from "multer";
import { HTTPError } from "lambert-server";
const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	res.json(await Sticker.find({ where: { guild_id } }));
});

const bodyParser = multer({
	limits: {
		fileSize: 1024 * 1024 * 100,
		fields: 10,
		files: 1,
	},
	storage: multer.memoryStorage(),
}).single("file");

router.post(
	"/",
	bodyParser,
	route({
		permission: "MANAGE_EMOJIS_AND_STICKERS",
		body: "ModifyGuildStickerSchema",
	}),
	async (req: Request, res: Response) => {
		if (!req.file) throw new HTTPError("missing file");

		const { guild_id } = req.params;
		const body = req.body as ModifyGuildStickerSchema;
		const id = Snowflake.generate();

		const [sticker] = await Promise.all([
			Sticker.create({
				...body,
				guild_id,
				id,
				type: StickerType.GUILD,
				format_type: getStickerFormat(req.file.mimetype),
				available: true,
			}).save(),
			uploadFile(`/stickers/${id}`, req.file),
		]);

		await sendStickerUpdateEvent(guild_id);

		res.json(sticker);
	},
);

export function getStickerFormat(mime_type: string) {
	switch (mime_type) {
		case "image/apng":
			return StickerFormatType.APNG;
		case "application/json":
			return StickerFormatType.LOTTIE;
		case "image/png":
			return StickerFormatType.PNG;
		case "image/gif":
			return StickerFormatType.GIF;
		default:
			throw new HTTPError(
				"invalid sticker format: must be png, apng or lottie",
			);
	}
}

router.get("/:sticker_id", route({}), async (req: Request, res: Response) => {
	const { guild_id, sticker_id } = req.params;
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	res.json(
		await Sticker.findOneOrFail({ where: { guild_id, id: sticker_id } }),
	);
});

router.patch(
	"/:sticker_id",
	route({
		body: "ModifyGuildStickerSchema",
		permission: "MANAGE_EMOJIS_AND_STICKERS",
	}),
	async (req: Request, res: Response) => {
		const { guild_id, sticker_id } = req.params;
		const body = req.body as ModifyGuildStickerSchema;

		const sticker = await Sticker.create({
			...body,
			guild_id,
			id: sticker_id,
		}).save();
		await sendStickerUpdateEvent(guild_id);

		return res.json(sticker);
	},
);

async function sendStickerUpdateEvent(guild_id: string) {
	return emitEvent({
		event: "GUILD_STICKERS_UPDATE",
		guild_id: guild_id,
		data: {
			guild_id: guild_id,
			stickers: await Sticker.find({ where: { guild_id: guild_id } }),
		},
	} as GuildStickersUpdateEvent);
}

router.delete(
	"/:sticker_id",
	route({ permission: "MANAGE_EMOJIS_AND_STICKERS" }),
	async (req: Request, res: Response) => {
		const { guild_id, sticker_id } = req.params;

		await Sticker.delete({ guild_id, id: sticker_id });
		await sendStickerUpdateEvent(guild_id);

		return res.sendStatus(204);
	},
);

export default router;
