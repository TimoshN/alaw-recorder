
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

async function activeSound () {
    // Tell user that this
    // program wants to use
    // the microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

    onMicrophoneGranted(stream)
}