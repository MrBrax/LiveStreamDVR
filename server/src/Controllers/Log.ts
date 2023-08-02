import { getLogLines } from "@/Core/Log";
// import { fetchLog } from "@/Core/Log";
import type { ApiLogResponse } from "@common/Api/Api";
import { isValid, parseJSON } from "date-fns";
import type express from "express";

export async function GetLog(req: express.Request, res: express.Response) {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const startFrom = req.query.startFrom
        ? parseInt(req.query.startFrom as string)
        : undefined;
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
    }

    /**
     * @TODO The lack of a start from field in winston makes this a lot more complicated. Maybe not even worth doing at all.
     */

    const allData = await getLogLines({
        from,
        to,
        limit /* start: startFrom */,
    });

    if (!(transport in allData)) {
        res.api(400, {
            status: "ERROR",
            message: "Invalid transport",
        });
        return;
    }

    const data = allData[transport];

    res.api<ApiLogResponse>(200, {
        status: "OK",
        data: {
            lines: data,
            amount: data.length,
            from: from.toISOString(),
            to: to.toISOString(),
            limit,
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
