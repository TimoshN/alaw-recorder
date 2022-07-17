
function floatTo16BitPCM(input) {
    let buffer = new ArrayBuffer(input.length*2)
    let view = new DataView(buffer)
    let offset = 0;

    for (let i = 0; i < input.length; i++, offset += 2) {
        let value = Math.max(-1, Math.min(input[i], +1));
        value = value < 0 ? value * 32768 : value * 32767;
        value = Math.round(value)|0;
        view.setInt16(offset, value, true)
    }

    return new Uint8Array(view.buffer)
}

function writeString(view, offset, string){
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function encodeWAV(isAlaw, sampleRate, numChannels){
    let bits = isAlaw ? 8 : 16
    let bytes = bits >> 3;
    let samples = 5*60*sampleRate * numChannels * bytes;

    let buffer = new ArrayBuffer(44);
    let view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */ //1 - linear, 6 - alaw
    view.setUint16(20, isAlaw ? 6 : 1, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numChannels * bytes, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numChannels * bytes, true);
    /* bits per sample */
    view.setUint16(34, bits, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples, true);

    // floatTo16BitPCM(view, 44, samples);

    return new Uint8Array(view.buffer)
}


/** @type {!Array<number>} */
const LOG_TABLE = [
    1,1,2,2,3,3,3,3,4,4,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7
];

/**
 * Encode a 16-bit linear PCM sample as 8-bit A-Law.
 * @param {number} sample A 16-bit PCM sample
 * @return {number}
 */
function encodeSample(sample) {
    /** @type {number} */
    let compandedValue;
    sample = (sample ==-32768) ? -32767 : sample;
    /** @type {number} */
    let sign = ((~sample) >> 8) & 0x80;
    if (!sign) {
        sample = sample * -1;
    }
    if (sample > 32635) {
        sample = 32635;
    }
    if (sample >= 256)  {
        /** @type {number} */
        let exponent = LOG_TABLE[(sample >> 8) & 0x7F];
        /** @type {number} */
        let mantissa = (sample >> (exponent + 3) ) & 0x0F;
        compandedValue = ((exponent << 4) | mantissa);
    } else {
        compandedValue = sample >> 4;
    }
    return compandedValue ^ (sign ^ 0x55);
}

/**
 * Encode 16-bit linear PCM samples as 8-bit A-Law samples.
 * @param {!Int16Array} samples A array of 16-bit PCM samples.
 * @return {!Uint8Array}
 */
function encode(samples) {
    /** @type {!Uint8Array} */
    let aLawSamples = new Uint8Array(samples.length);
    for (let i=0; i<samples.length; i++) {
        aLawSamples[i] = encodeSample(samples[i]);
    }
    return aLawSamples;
}