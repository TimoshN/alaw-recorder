// This is the way to register an AudioWorkletProcessor
// it's necessary to declare a name, in this case
// the name is "microphone"

registerProcessor('microphone', class extends AudioWorkletProcessor {
  constructor () {
    super();
    this._stopTime = 999999999;
    this._startTime = 0;
    this._stopRecording = true;
    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.eventType == "stopRecording") {
        this._stopTime = data.stopTime;
        this._stopRecording = true;
      }

      if (data.eventType == "startRecording") {
        this._startTime = data.startTime;
        this._stopRecording = false;
        this._recordingStarted()
      }
    };
    this._bufferSize = 2048;
    this._buffers = null;
    this._initBuffer();
    this._initBuffers(1); //numberOfChannels
  }

  _initBuffers(numberOfChannels) {
    this._buffers = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      this._buffers.push(new Float32Array(this._bufferSize));
    }
  }

  _initBuffer() {
    this._bytesWritten = 0;
  }

  _isBufferEmpty() {
    return this._bytesWritten === 0;
  }

  _isBufferFull() {
    return this._bytesWritten === this._bufferSize;
  }

  _pushToBuffers(audioRawData, numberOfChannels) {
    if (this._isBufferFull()) {
      this._flush();
    }

    let dataLength = audioRawData[0].length;

    for (let idx = 0; idx < dataLength; idx++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        let value = audioRawData[channel][idx];
        this._buffers[channel][this._bytesWritten] = value;
      }
      this._bytesWritten += 1;
    }
  }

  _flush() {
    let buffers = [];
    this._buffers.forEach((buffer, channel) => {
      if (this._bytesWritten < this._bufferSize) {
        buffer = buffer.slice(0, this._bytesWritten);
      }
      buffers[channel] = buffer;
    });
    this.port.postMessage({
      eventType: "data",
      audioBuffer: buffers,
      bufferSize: this._bufferSize,
    });
    this._initBuffer();
    this._initBuffers(1);
  }

  _recordingStarted() {
    this.port.postMessage({
      eventType: "started",
    });
  }

  _recordingStopped() {
    this.port.postMessage({
      eventType: "stop",
    });
  }

  process (inputs, outputs, parameters) {
    if (inputs[0] == null) {
        console.log("FROM WORKLET: input is null");
        return;
    }

    if (this._buffers === null) {
        this._initBuffer();
        this._initBuffers(1);
    }

    if ( this._stopRecording && !this._isBufferEmpty() ) {
        this._flush();
        this._recordingStopped();
      } else if (!this._stopRecording) {
        this._pushToBuffers(inputs[0], 1); //data, numberOfChannels
      }

    return true;
  }
});