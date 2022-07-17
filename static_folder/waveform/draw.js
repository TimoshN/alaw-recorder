
let canvasWidth  = 500
let canvasHeight = 100
let newCanvas    = document.querySelector("#waveform")
let context      = newCanvas.getContext('2d');

function displayBuffer(buff) {

    let drawLines = 1000;

    /** @type {Float32Array} */
    let leftChannel = buff.getChannelData(0); // Float32Array describing left channel
    let lineOpacity = canvasWidth / leftChannel.length  ;
    context.save();
    context.fillStyle = '#ffffff' ;
    context.fillRect(0,0,canvasWidth,canvasHeight );
    context.strokeStyle = '#46a0ba';
    // context.globalCompositeOperation = 'lighter';
    context.translate(0,canvasHeight / 2);
    //context.globalAlpha = 0.6 ; // lineOpacity ;
    context.lineWidth=1;
    let totallength = leftChannel.length;
    let eachBlock = Math.floor(totallength / drawLines);
    let lineGap = (canvasWidth/drawLines);

    context.beginPath();
    for(let i=0;i<=drawLines;i++){
        let audioBuffKey = Math.floor(eachBlock * i);
        let x = i*lineGap;
        let y = leftChannel[audioBuffKey] * canvasHeight / 2;
        context.moveTo( x, y );
        context.lineTo( x, (y*-1) );
    }
    context.stroke();
    context.restore();
}