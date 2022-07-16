
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
})