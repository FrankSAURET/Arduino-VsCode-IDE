// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { SerialPort } from "serialport";

export interface ISerialPortDetail {
    port: string;
    desc: string;
    vendorId: string;
    productId: string;
}

export async function listSerialPorts(): Promise<ISerialPortDetail[]> {
    return (await SerialPort.list()).map((p) => ({
        port: p.path,
        desc: (p as any).friendlyName ?? p.manufacturer,
        vendorId: p.vendorId,
        productId: p.productId,
    }));
}
