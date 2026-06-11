"use strict";
/**
 * Type definitions for usbmux protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsbMuxMessageType = exports.UsbMuxResult = exports.UsbMuxVersion = void 0;
// usbmuxd protocol version
var UsbMuxVersion;
(function (UsbMuxVersion) {
    UsbMuxVersion[UsbMuxVersion["BINARY"] = 0] = "BINARY";
    UsbMuxVersion[UsbMuxVersion["PLIST"] = 1] = "PLIST";
})(UsbMuxVersion || (exports.UsbMuxVersion = UsbMuxVersion = {}));
// usbmuxd result codes
var UsbMuxResult;
(function (UsbMuxResult) {
    UsbMuxResult[UsbMuxResult["OK"] = 0] = "OK";
    UsbMuxResult[UsbMuxResult["BAD_COMMAND"] = 1] = "BAD_COMMAND";
    UsbMuxResult[UsbMuxResult["BAD_DEVICE"] = 2] = "BAD_DEVICE";
    UsbMuxResult[UsbMuxResult["CONNECTION_REFUSED"] = 3] = "CONNECTION_REFUSED";
    UsbMuxResult[UsbMuxResult["NO_SUCH_SERVICE"] = 4] = "NO_SUCH_SERVICE";
    UsbMuxResult[UsbMuxResult["BAD_VERSION"] = 6] = "BAD_VERSION";
})(UsbMuxResult || (exports.UsbMuxResult = UsbMuxResult = {}));
// usbmuxd message types
var UsbMuxMessageType;
(function (UsbMuxMessageType) {
    UsbMuxMessageType[UsbMuxMessageType["RESULT"] = 1] = "RESULT";
    UsbMuxMessageType[UsbMuxMessageType["CONNECT"] = 2] = "CONNECT";
    UsbMuxMessageType[UsbMuxMessageType["LISTEN"] = 3] = "LISTEN";
    UsbMuxMessageType[UsbMuxMessageType["ADD"] = 4] = "ADD";
    UsbMuxMessageType[UsbMuxMessageType["REMOVE"] = 5] = "REMOVE";
    UsbMuxMessageType[UsbMuxMessageType["PAIRED"] = 6] = "PAIRED";
    UsbMuxMessageType[UsbMuxMessageType["PLIST"] = 8] = "PLIST";
})(UsbMuxMessageType || (exports.UsbMuxMessageType = UsbMuxMessageType = {}));
//# sourceMappingURL=types.js.map