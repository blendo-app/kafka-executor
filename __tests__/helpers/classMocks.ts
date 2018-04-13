export const spyClass = (classn: Function): any => {
    const proto = classn.prototype;
    return Object.getOwnPropertyNames(proto).reduce((accum, key: string) => {
        const instanceProperty = proto[key];
        if (typeof instanceProperty === 'function') {
            accum[key] = jest.spyOn(proto, key);
        }
        return accum;
    }, {});
};
const isConstructor = (ClassForTest) => {
    try {
        new ClassForTest();
        return true;
    } catch (err) {
        return false;
    }
};
export const mockClass = (ClassForMock: Function, customMock: any = {}, extendFunctionality = {}): any => {
    const mock = (classToMock) => {
        const proto = classToMock.prototype;
        return Object.getOwnPropertyNames(proto).reduce((accum, key: string) => {
            const instanceProperty = proto[key];
            if (typeof instanceProperty === 'function') {
                accum[key] = jest.fn(customMock[key]);
            }
            return accum;
        }, {});
    };
    ClassForMock.prototype = mock(ClassForMock);
    return ClassForMock;
};