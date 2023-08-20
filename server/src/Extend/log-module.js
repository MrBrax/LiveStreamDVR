// eslint plugin for typescript that wants the second argument of `log` to have a dot in it

module.exports = {
    name: "log-module",
    meta: {
        type: "problem",
        docs: {
            description: "enforce dot in log",
        },
        // fixable: "code",
    },
    create: (context) => ({
        CallExpression(node) {
            if (
                // match imported function "log" only
                node.callee.type === "Identifier" &&
                node.callee.name === "log" &&
                node.arguments[1] &&
                node.arguments[1].value &&
                !node.arguments[1].value.includes(".")
            ) {
                context.report({
                    node,
                    message:
                        "log() must have a module and a function separated by a dot to make it less ambiguous",
                });
            }
        },
    }),
};
