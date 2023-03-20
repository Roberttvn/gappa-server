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

import { Router, Response, Request } from "express";
import fetch from "node-fetch";
import ProxyAgent from "proxy-agent";
import { route } from "@fosscord/api";
import { getGifApiKey, parseGifResult } from "./trending";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	// TODO: Custom providers
	const { media_format, locale } = req.query;

	const apiKey = getGifApiKey();

	const agent = new ProxyAgent();

	const response = await fetch(
		`https://g.tenor.com/v1/trending?media_format=${media_format}&locale=${locale}&key=${apiKey}`,
		{
			agent,
			method: "get",
			headers: { "Content-Type": "application/json" },
		},
	);

	const { results } = await response.json();

	res.json(results.map(parseGifResult)).status(200);
});

export default router;
