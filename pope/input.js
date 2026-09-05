(function() {

  Module.onRuntimeInitialize = () => {
    Module.elementPointerLock = false;
  };
  
  (function() {
    // Stop the canvas from getting too tall for the phone in landscape mode.
/*    const canvas = document.getElementById('canvas')

    const resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        const entry = entries[0]
        const maxHeight = window.innerHeight * 0.75;
        const canvasHeight = entry.contentBoxSize[0].blockSize
        if (canvasHeight > maxHeight) {
          canvas.style.height = `${maxHeight}px`;
        }
      });
    });

    resizeObserver.observe(canvas);*/
  }());
  
  //// Virtual gamepad

  function disableDrag(element) {
    element.addEventListener('dragstart', event => {
      event.preventDefault();
    });

    element.addEventListener('drop', event => {
      event.preventDefault();
    });
  }

  const buttona = document.getElementById('button0a');
  const buttonb = document.getElementById('button0b');
  const stick = document.getElementById('stick0');
  disableDrag(buttona);
  disableDrag(buttonb);
  disableDrag(stick);

  class VirtualStick {
    constructor(gamepadIdx, axisX, axisY, stickElement, activeSticks, deadZone) {
      this.gamepadIdx = gamepadIdx;
      this.axisX = axisX;
      this.axisY = axisY;
      this.stickElement = stickElement;
      this.pointerId = -1;
      this.startX = 0;
      this.startY = 0;
      this.deadZone = deadZone;

      this.stickElement.addEventListener("pointerdown", (event) => {
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.update(event.clientX, event.clientY);
        
        if (activeSticks.indexOf(this) == -1)
          activeSticks.push(this);
        
        event.preventDefault();
      }, {passive: false});
    }

    update(clientX, clientY) {
      const offsetX = clientX - this.startX;
      const offsetY = clientY - this.startY;
      
      var x = Math.max(-1.0, Math.min(1.0, 2 * (offsetX / this.stickElement.offsetWidth)));
      var y = Math.max(-1.0, Math.min(1.0, 2 * (offsetY / this.stickElement.offsetHeight)));

      if (Math.abs(x) < this.deadZone)
        x = 0;
      if (Math.abs(y) < this.deadZone)
        y = 0;
      
      Module.ArseVirtualGamepad.axis[this.gamepadIdx] = [
        { gamepadIdx: this.gamepadIdx, axis: this.axisX, timestampMs: event.timeStamp, pos: x, consumed: false },
        { gamepadIdx: this.gamepadIdx, axis: this.axisY, timestampMs: event.timeStamp, pos: y, consumed: false }
      ];
    };
    
    stop(timeStamp) {
      Module.ArseVirtualGamepad.axis[this.gamepadIdx] = [
        { gamepadIdx: this.gamepadIdx, axis: this.axisX, timestampMs: timeStamp, pos: 0, consumed: false },
        { gamepadIdx: this.gamepadIdx, axis: this.axisY, timestampMs: timeStamp, pos: 0, consumed: false }
      ];
    };
  };

  const activeSticks = [];
  
  document.addEventListener("pointermove", (event) => {
      for (const stick of activeSticks) {
        stick.update(event.clientX, event.clientY);
      }

      if (activeSticks.length)
        event.preventDefault();
    }, {passive: false});

    document.addEventListener("pointerup", (event) => {
      var activeSticksNew = activeSticks;
      
      for (const stick of activeSticks) {
        if (stick.pointerId == event.pointerId) {
          activeSticksNew = activeSticksNew.filter(s => s.pointerId !== event.pointerId);
          stick.stop();
        }
      }

      if (activeSticks.length) {
        event.preventDefault();
      }

      activeSticks.length = 0;
      for (const e of activeSticksNew)
        activeSticks.push(e)
    });
    
  for (const el of [buttona, buttonb, stick]) {
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  
  Module.onArseInitialized = async function() {
    Module.ArseVirtualGamepad = {
      axis: [[]],
      button: [[]],
      collectEvents: null
    };

    new VirtualStick(0, Module.GamepadAxis.LEFT_X, Module.GamepadAxis.LEFT_Y, stick, activeSticks, 0.01);

    const arseApp = await Module.App.current();
    const inputDevices = await arseApp.inputDevices();

    // This is called from InputDevices.cpp
    Module.ArseVirtualGamepad.collectEvents = async () => {
      for (const gamepadIdx in Module.ArseVirtualGamepad.axis) {
        const events = [...Module.ArseVirtualGamepad.axis[gamepadIdx]]
        // Note: don't clear axis events. Input will expect an axis value every frame.
        for (const e of events) {
          await inputDevices.onGamepadAxis(e);
        }
      }

      for (const gamepadIdx in Module.ArseVirtualGamepad.button) {
        const events = [...Module.ArseVirtualGamepad.button[gamepadIdx]]
        Module.ArseVirtualGamepad.button[gamepadIdx].length = 0;
        for (const e of events) {
          await inputDevices.onGamepadButton(e);
        }
      }
    };

    function makeHandleGamepadButtonFunc(gamepadIdx, buttonEnum, isDown) {
      return () => {
        Module.ArseVirtualGamepad.button[gamepadIdx].push(
          { gamepadIdx: gamepadIdx, isDown: isDown, button: buttonEnum, timestampMs: event.timeStamp, consumed: false }
        );
        
        event.preventDefault();
      };
    };

    buttona.addEventListener("pointerdown", makeHandleGamepadButtonFunc(0, Module.GamepadButton.A, true));
    buttona.addEventListener("pointerup", makeHandleGamepadButtonFunc(0, Module.GamepadButton.A, false));
    buttonb.addEventListener("pointerdown", makeHandleGamepadButtonFunc(0, Module.GamepadButton.B, true));
    buttonb.addEventListener("pointerup", makeHandleGamepadButtonFunc(0, Module.GamepadButton.B, false));
  }
}());

