
window.addEventListener("DOMContentLoaded", ()=>{

    const $button = document.querySelector('#start')
    const $button2 = document.querySelector('#stop')

    $button.addEventListener("click", ()=>{
        $button.disabled = true;
        $button2.disabled = true;

        activeSound()
        .then(()=>{
            $button2.disabled = false;
        })
        .catch(()=>{
            $button.disabled = false;
        })
    })

    $button2.addEventListener("click", ()=>{
        $button.disabled = false;
        $button2.disabled = true;

        stopRecording()
    })

    let audioContext = new AudioContext({
        sampleRate: 15000
    });

    const $audio = document.querySelector('#audio')

    const $file = document.querySelector('#pick-file')
    $file.addEventListener("change", ()=>{

        $audio.removeAttribute('src');

        if ($file.files[0]) {
            $file.files[0].arrayBuffer().then((buffer)=>{
                audioContext.decodeAudioData(buffer)
                .then((decodedBuffer)=>{

                    displayBuffer(decodedBuffer)

                    const filePath = saveFile(decodedBuffer)

                    setTimeout(()=>{
                        $audio.setAttribute('src', filePath)
                    }, 500)
                })
                .catch((err)=>{
                    console.log(err)
                })
            })
        }
    })
})

function saveFile(decodedBuffer) {
    const header = encodeWAV(true, 15000, 1)
    const filePath = window.api.writeToStream(header);

    let leftChannel = decodedBuffer.getChannelData(0)

    const pcm = new Int16Array(floatTo16BitPCM(leftChannel).buffer);
    // console.log("pcm ", pcm)

    const alaw = encode(pcm);

    window.api.writeToStream(alaw);

    window.api.closeStream()

    __decodedBuffer = null;

    return filePath;
}