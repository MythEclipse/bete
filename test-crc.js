const { crc } = require('node-crc');

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
        r = (r & 0x80000000) !== 0 ? ((r << 1) ^ 0x04c11db7) : (r << 1);
    }
    CRC_TABLE[i] = (r >>> 0);
}

function calculateOggCrc(buffer) {
    let crc = 0;
    for (let i = 0; i < buffer.length; i++) {
        crc = ((crc << 8) >>> 0) ^ CRC_TABLE[((crc >>> 24) ^ buffer[i]) & 0xff];
        crc >>>= 0;
    }
    return crc;
}

const testBuffer = Buffer.from("hello world this is a test page", "utf-8");

const expectedBuffer = crc(32, false, 0x04c11db7, 0, 0, 0, 0, 0, testBuffer);
const expected = expectedBuffer.readUInt32BE(0);

const actual = calculateOggCrc(testBuffer);

console.log({
    expected: expected.toString(16),
    actual: actual.toString(16),
    match: expected === actual
});
