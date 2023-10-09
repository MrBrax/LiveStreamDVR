// import ApiRouter from "../Routes/Api";

export function Route(method: "get" | "post" | "put" | "delete", path: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        // console.log(target, propertyKey, descriptor, path);
        // console.debug(
        //     `Adding experimental route ${method} ${path} with decorators`
        // );
        // ApiRouter[method](path, (req, res, next) => {
        //     descriptor.value(req, res, next);
        // });
    };
}

export function RouteController(path: string) {
    return function (target: any) {
        console.log(target, path);
    };
}
