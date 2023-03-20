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

import { Channel, emitEvent, Member, TypingStartEvent } from "@fosscord/util";
import { route } from "@fosscord/api";
import { Router, Request, Response } from "express";

const router: Router = Router();

router.post(
	"/",
	route({ permission: "SEND_MESSAGES" }),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;
		const user_id = req.user_id;
		const timestamp = Date.now();
		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
		});
		const member = await Member.findOne({
			where: { id: user_id, guild_id: channel.guild_id },
			relations: ["roles", "user"],
		});

		await emitEvent({
			event: "TYPING_START",
			channel_id: channel_id,
			data: {
				...(member
					? {
							member: {
								...member,
								roles: member?.roles?.map((x) => x.id),
							},
					  }
					: null),
				channel_id,
				timestamp,
				user_id,
				guild_id: channel.guild_id,
			},
		} as TypingStartEvent);

		res.sendStatus(204);
	},
);

export default router;
