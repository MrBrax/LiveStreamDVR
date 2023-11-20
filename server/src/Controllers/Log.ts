import { LOGLEVEL, getLogLines, log } from "@/Core/Log";
import { ZodErrorMessageResponse } from "@/Helpers/Zod";
// import { fetchLog } from "@/Core/Log";
import type { ApiLogResponse } from "@common/Api/Api";
import type express from "express";
import { z } from "zod";

export async function GetLog(req: express.Request, res: express.Response) {
    /*
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    // const startFrom = req.query.startFrom
    //     ? parseInt(req.query.startFrom as string)
    //     : undefined;
    const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
    const transport = (req.query.transport as string) || "dailyRotateFile";

    if (!dateFrom) {
        res.api(400, {
            status: "ERROR",
            message: "Missing dateFrom",
        });
        return;
    }

    const from = parseJSON(dateFrom);
    if (!isValid(from)) {
        res.api(400, {
            status: "ERROR",
            message: "Invalid dateFrom",
        });
        return;
    }

    const to = dateTo ? parseJSON(dateTo) : new Date();

    if (!isValid(to)) {
        res.api(400, {
            status: "ERROR",
            message: "Invalid dateTo",
        });
        return;
    }*/

    const querySchema = z.object({
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date().optional().default(new Date()),
        limit: z.number().optional(),
        transport: z.string().optional().default("dailyRotateFile"),
    });

    const query = querySchema.safeParse(req.query);
    if (!query.success) {
        res.api(400, {
            status: "ERROR",
            message: ZodErrorMessageResponse(query.error),
        });
        return;
    }

    /**
     * @TODO The lack of a start from field in winston makes this a lot more complicated. Maybe not even worth doing at all.
     */

    let allData;

    try {
        allData = await getLogLines({
            from: query.data.dateFrom,
            to: query.data.dateTo,
            limit: query.data.limit,
        });
    } catch (error) {
        res.api(400, {
            status: "ERROR",
            message: (error as Error).message,
        });
        return;
    }

    if (!allData) {
        res.api(400, {
            status: "ERROR",
            message: "No data",
        });
        return;
    }

    if (!(query.data.transport in allData)) {
        res.api(400, {
            status: "ERROR",
            message: "Invalid transport",
        });
        return;
    }

    const data = allData[query.data.transport];

    log(
        LOGLEVEL.ERROR,
        "log",
        `Querying log from ${query.data.dateFrom.toISOString()} to ${query.data.dateTo.toISOString()} with limit ${
            query.data.limit
        } and transport ${query.data.transport}`
    );

    res.api<ApiLogResponse>(200, {
        status: "OK",
        data: {
            lines: data,
            amount: data.length,
            from: query.data.dateFrom.toISOString(),
            to: query.data.dateTo.toISOString(),
            limit: query.data.limit,
        },
    });

    /*
    const filename = req.params.filename;

    const start_from = req.params.startFrom
        ? parseInt(req.params.startFrom)
        : 0;

    if (!filename) {
        res.api(400, {
            status: "ERROR",
            message: "Missing filename",
        });
        return;
    }

    const log_lines: ApiLogLine[] = [];

    /*
    try {
        log_lines = fetchLog(filename, start_from) as ApiLogLine[];
    } catch (error) {
        res.api(400, {
            status: "ERROR",
            message: (error as Error).message,
        } as ApiErrorResponse);
        return;
    }
    *

    for (const i in log_lines) {
        if (log_lines[i].time) {
            log_lines[i].date_string = format(
                new Date(log_lines[i].time),
                "yyyy-MM-dd HH:mm:ss"
            );
            log_lines[i].date = new Date(log_lines[i].time).toISOString();
        }
    }

    const line_num = log_lines.length;

    const logfiles = fs
        .readdirSync(BaseConfigDataFolder.logs)
        .filter((f) => f.endsWith(".jsonline"))
        .map((f) => f.replace(".log.jsonline", ""));

    res.api<ApiLogResponse>(200, {
        data: {
            lines: log_lines,
            last_line: line_num,
            logs: logfiles,
        },
        status: "OK",
    });
    */
}
