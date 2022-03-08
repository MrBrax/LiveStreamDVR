import { BaseConfigFolder } from "../Core/BaseConfig";
import express from "express";
import fs from "fs";
import path from "path";

export function About(req: express.Request, res: express.Response) {
    
    /*
    $bins = [];

    $pip_requirements = [];
    $requirements_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "requirements.txt";
    if (file_exists($requirements_file)) {
        $requirements_data = file_get_contents($requirements_file);
        $lines = explode("\n", $requirements_data);
        foreach ($lines as $line) {
            preg_match("/^([a-z_-]+)([=<>]+)(.*)$/", $line, $matches);
            if ($matches) {
                $pip_requirements[trim($matches[1])] = [
                    'comparator' => trim($matches[2]),
                    'version' => trim($matches[3])
                ];
            }
        }
    }
    */

    const bins = {};

    const pip_requirements: Record<string, { comparator: string; version: string; }> = {};
    const requirements_file = path.join(__dirname, "..", "..", "..", "requirements.txt");
    if (fs.existsSync(requirements_file)) {
        const requirements_data = fs.readFileSync(requirements_file, "utf8");
        const lines = requirements_data.split("\n");
        lines.forEach(line => {
            const matches = line.trim().match(/^([a-z_-]+)([=<>]+)([0-9.]+)$/);
            if (matches) {
                pip_requirements[matches[1].trim()] = {
                    comparator: matches[2].trim(),
                    version: matches[3].trim(),
                };
            } else {
                console.log("Failed to parse line:", line);
            }
        });
    } else {
        console.error("requirements.txt not found", requirements_file);
    }

    /*
    $cron_lastrun = [];
    foreach (['check_deleted_vods', 'check_muted_vods', 'dump_playlists'] as $cron) {
        $fp = TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . $cron;
        if (file_exists($fp)) {
            $t = (int)file_get_contents($fp);
            $cron_lastrun[$cron] = date("Y-m-d H:i:s", $t);
        } else {
            $cron_lastrun[$cron] = "Never run";
        }
    }
    */

    const cron_lastrun: Record<string, string> = {};
    for (const cron of ["check_deleted_vods", "check_muted_vods", "dump_playlists"]) {
        const fp = path.join(BaseConfigFolder.cr on, cron);
        if (fs.existsSync(fp)) {
            const t = fs.readFileSync(fp, "utf8");
            cron_lastrun[cron] = new Date(parseInt(t)).toISOString();
        } else {
            cron_lastrun[cron] = "Never run";
        }
    }

    res.send({
        data: {
            bins: bins,
            pip: pip_requirements,
            cron_lastrun: cron_lastrun,
            is_docker: process.env.TCD_DOCKER == "1",
        },
        status: "OK",
    });

}