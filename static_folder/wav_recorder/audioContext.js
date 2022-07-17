
function createAudioContext() {
    return new Promise( async (resolve, reject)=>{
        try {
            let callback = ()=>{};
            let callbackAnalyzer =()=>{};
            let _microphone;
            let _stream;

            // Initialize AudioContext object
            let audioContext = new AudioContext({
                sampleRate: 15000
            })

            console.log("Sample rate", audioContext.sampleRate)

            // Adding an AudioWorkletProcessor
            // from another script with addModule method
            await audioContext.audioWorklet.addModule('wav_recorder/audioProcessor.js')


            let analyserNode = new AnalyserNode(audioContext, {
                fftSize: 128,
                smoothingTimeConstant: 0.5,
            });

            let dataArray = new Uint8Array(analyserNode.frequencyBinCount);

            let interval;

            // Creating AudioWorkletNode sending
            // context and name of processor registered
            // in audioProcessor.js
            let node = new AudioWorkletNode(audioContext, 'microphone')

            // Listing any message from AudioWorkletProcessor in its
            // process method here where you can know
            // the volume level

            node.port.onmessage = event => {
                const data = event.data

                if (data.eventType == "started") {
                    console.log("startedRecording")
                    callback({
                        event: 'started'
                    })
                } else if (data.eventType == "stop") {

                    clearInterval(interval)
                    interval=null;

                    console.log("RECORDING STOPPED");
                    node.disconnect(audioContext.destination)
                    analyserNode.disconnect(node)
                    _microphone.disconnect(analyserNode)
                    _stream.getTracks().forEach((el)=>{
                        el.stop()
                    })

                    audioContext.suspend();

                    callback({
                        event: 'stopped'
                    })
                } else if (data.eventType == "data") {
                    const pcm = new Int16Array(floatTo16BitPCM(data.audioBuffer[0]).buffer);
                    // console.log("pcm ", pcm)

                    const alaw = encode(pcm);
                    // console.log('alaw ', alaw)


                    callback({
                        event: 'data',
                        data: alaw
                    })
                }
            }


            console.log("start Recorder Worklet()");

            resolve({
                connect: (stream)=>{

                    audioContext.resume();

                    _stream = stream;
                    _microphone = audioContext.createMediaStreamSource(_stream)

                    // Now this is the way to
                    // connect our microphone to
                    // the AudioWorkletNode and output from audioContext
                    _microphone
                        .connect(analyserNode)
                        .connect(node)
                        .connect(audioContext.destination)

                    interval = setInterval(()=>{
                        analyserNode.getByteFrequencyData(dataArray)
                        callbackAnalyzer(dataArray);
                    }, 50)
                },
                startRecording: ()=>{
                    node.port.postMessage({
                        eventType: "startRecording",
                    });
                },
                stopRecording: ()=>{
                    node.port.postMessage({
                        eventType: "stopRecording",
                    });
                },
                setCallback: (func)=>{
                    callback = func
                },
                setCallbackAnalyzer: (func)=>{
                    callbackAnalyzer = func
                }
            })
        } catch(e) {
            reject(e)
        }
    })
}


let haveContext
let canvasCtx
/**
 * Method used to create a comunication between
 * AudioWorkletNode, Microphone and AudioWorkletProcessor
 *
 * @param {MediaStream} stream If user grant access to microphone, this gives you
 * a MediaStream object necessary in this implementation
 */
function onMicrophoneGranted(stream) {
    return new Promise(async (resolve, reject)=>{
        // Instanciate just in the first time
        // when button is pressed
        try {

            if (!haveContext) {
                haveContext = await createAudioContext()
            }

            if (!canvasCtx) {
                let canvas = document.getElementById('analyzer');
                canvasCtx = canvas.getContext('2d');
                canvasCtx.clearRect(0, 0, 200, 50);
            }

            haveContext.connect(stream)

            let isFirstPackage = true;

            haveContext.setCallback((e)=>{
                if (e.event == "data") {
                    if (isFirstPackage) {
                        isFirstPackage = false
                        const header = encodeWAV(true, 15000, 1)
                        window.api.writeToStream(header);
                    }

                    window.api.writeToStream(e.data)
                } else if (e.event == "started") {

                } else if (e.event == "stopped") {
                    window.api.closeStream()
                }
            })
            haveContext.setCallbackAnalyzer((dataArray)=>{
                if(!canvasCtx){ return }

                canvasCtx.clearRect(0, 0, 200, 100);

                let barWidth = (200 / dataArray.length) //* 2.5;
                let barHeight;
                let x = 0;

                //ctx.fillRect(x, y, width, height);

                for(let i = 0; i < dataArray.length; i++) {
                    barHeight = dataArray[i]/255*50

                    canvasCtx.fillStyle = `rgb(100,100,${(100+(dataArray[i]/255*125))})`;
                    canvasCtx.fillRect(x, 100-barHeight, barWidth, barHeight);

                    x += barWidth;
                }
            })

            haveContext.startRecording()


            resolve()
        } catch(e) {
            reject(e)
        }
    })
}

function stopRecording() {
    haveContext.stopRecording()
}

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

async function activeSound () {
    // Tell user that this
    // program wants to use
    // the microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

    onMicrophoneGranted(stream)
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