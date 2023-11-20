import type { z } from "zod";

export function ZodErrorMessageResponse(error: z.ZodError<any>): {
    status: "ERROR";
    message: string;
} {
    return {
        status: "ERROR",
        message: error.issues.map((issue) => issue.message).join(", "),
    };
}
