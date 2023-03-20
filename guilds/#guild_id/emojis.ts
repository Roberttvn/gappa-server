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

import { Router, Request, Response } from "express";
import {
	Config,
	DiscordApiErrors,
	emitEvent,
	Emoji,
	GuildEmojisUpdateEvent,
	handleFile,
	Member,
	Snowflake,
	User,
	EmojiCreateSchema,
	EmojiModifySchema,
} from "@fosscord/util";
import { route } from "@fosscord/api";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;

	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const emojis = await Emoji.find({
		where: { guild_id: guild_id },
		relations: ["user"],
	});

	return res.json(emojis);
});

router.get("/:emoji_id", route({}), async (req: Request, res: Response) => {
	const { guild_id, emoji_id } = req.params;

	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const emoji = await Emoji.findOneOrFail({
		where: { guild_id: guild_id, id: emoji_id },
		relations: ["user"],
	});

	return res.json(emoji);
});

router.post(
	"/",
	route({
		body: "EmojiCreateSchema",
		permission: "MANAGE_EMOJIS_AND_STICKERS",
	}),
	async (req: Request, res: Response) => {
		const { guild_id } = req.params;
		const body = req.body as EmojiCreateSchema;

		const id = Snowflake.generate();
		const emoji_count = await Emoji.count({
			where: { guild_id: guild_id },
		});
		const { maxEmojis } = Config.get().limits.guild;

		if (emoji_count >= maxEmojis)
			throw DiscordApiErrors.MAXIMUM_NUMBER_OF_EMOJIS_REACHED.withParams(
				maxEmojis,
			);
		if (body.require_colons == null) body.require_colons = true;

		const user = await User.findOneOrFail({ where: { id: req.user_id } });
		body.image = (await handleFile(`/emojis/${id}`, body.image)) as string;

		const emoji = await Emoji.create({
			id: id,
			guild_id: guild_id,
			...body,
			require_colons: body.require_colons ?? undefined, // schema allows nulls, db does not
			user: user,
			managed: false,
			animated: false, // TODO: Add support animated emojis
			available: true,
			roles: [],
		}).save();

		await emitEvent({
			event: "GUILD_EMOJIS_UPDATE",
			guild_id: guild_id,
			data: {
				guild_id: guild_id,
				emojis: await Emoji.find({ where: { guild_id: guild_id } }),
			},
		} as GuildEmojisUpdateEvent);

		return res.status(201).json(emoji);
	},
);

router.patch(
	"/:emoji_id",
	route({
		body: "EmojiModifySchema",
		permission: "MANAGE_EMOJIS_AND_STICKERS",
	}),
	async (req: Request, res: Response) => {
		const { emoji_id, guild_id } = req.params;
		const body = req.body as EmojiModifySchema;

		const emoji = await Emoji.create({
			...body,
			id: emoji_id,
			guild_id: guild_id,
		}).save();

		await emitEvent({
			event: "GUILD_EMOJIS_UPDATE",
			guild_id: guild_id,
			data: {
				guild_id: guild_id,
				emojis: await Emoji.find({ where: { guild_id: guild_id } }),
			},
		} as GuildEmojisUpdateEvent);

		return res.json(emoji);
	},
);

router.delete(
	"/:emoji_id",
	route({ permission: "MANAGE_EMOJIS_AND_STICKERS" }),
	async (req: Request, res: Response) => {
		const { emoji_id, guild_id } = req.params;

		await Emoji.delete({
			id: emoji_id,
			guild_id: guild_id,
		});

		await emitEvent({
			event: "GUILD_EMOJIS_UPDATE",
			guild_id: guild_id,
			data: {
				guild_id: guild_id,
				emojis: await Emoji.find({ where: { guild_id: guild_id } }),
			},
		} as GuildEmojisUpdateEvent);

		res.sendStatus(204);
	},
);

export default router;
