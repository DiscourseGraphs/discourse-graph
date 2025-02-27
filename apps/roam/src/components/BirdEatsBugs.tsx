interface BirdEatsBug {
  initialize?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: any[]) => BirdEatsBug;
  load?: () => void;
  push?: (args: any[]) => void;
  setOptions?: (options: { 
    publicAppId: string;
    ui?: {
      position?: string;
      defaultButton?: {
        icon?: string;
      };
      text?: {
        defaultButton?: string;
      };
      watermark?: boolean;
    };
  }) => void;
  [key: string]: any;
  length?: number;
}

declare global {
  interface Window {
    birdeatsbug?: BirdEatsBug | any[];
  }
}

export const initBirdEatsBug = (): void => {
  // Create a queue, but don't obliterate an existing one!
  const birdeatsbug = (window.birdeatsbug = window.birdeatsbug || []) as BirdEatsBug;
  
  // If the real SDK is already on the page, return
  if (birdeatsbug.initialize) return;
  
  // If the snippet was invoked already, show an error
  if (birdeatsbug.invoked) {
    if (window.console && console.error) {
      console.error('birdeatsbug snippet included twice.');
    }
    return;
  }
  
  // Invoked flag, to make sure the snippet is never invoked twice
  birdeatsbug.invoked = true;
  
  // A list of the methods in the SDK to stub
  birdeatsbug.methods = [
    'setOptions',
    'trigger',
    'resumeSession',
    'takeScreenshot',
    'startRecording',
    'stopRecording',
    'stopSession',
    'uploadSession',
    'deleteSession',
  ];
  
  // Define a factory to create stubs. These are placeholders
  // for methods in the SDK so that you never have to wait
  // for it to load to record method calls
  birdeatsbug.factory = (method) => {
    return function() {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(method);
      birdeatsbug.push?.(args);
      return birdeatsbug;
    };
  };
  
  // For each of our methods, generate a queueing stub
  for (let i = 0; i < birdeatsbug.methods.length; i++) {
    const key = birdeatsbug.methods[i];
    birdeatsbug[key] = birdeatsbug.factory(key);
  }
  
  // Define a method to load the SDK and ensure it's only loaded once
  birdeatsbug.load = () => {
    // Create an async script element
    const script = document.createElement('script');
    script.type = 'module';
    script.async = true;
    script.src = 'https://sdk.birdeatsbug.com/v3/core.js';
    
    // Insert the script next to the first script element
    const mountJsBefore = document.getElementsByTagName('script')[0] || document.body.firstChild;
    mountJsBefore.parentNode?.insertBefore(script, mountJsBefore);

    // Create a style element
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = 'https://sdk.birdeatsbug.com/v3/style.css';
    
    // Insert the styles before the 1st style
    const mountCssBefore = document.querySelector('link[rel="stylesheet"]') || mountJsBefore;
    mountCssBefore.parentNode?.insertBefore(style, mountCssBefore);
  };
  
  // Load SDK
  birdeatsbug.load();
  
  // Add custom CSS for button positioning
  const customStyles = document.createElement('style');
  customStyles.textContent = `
   
    /* Target the specific Bird Eats Bug container */
    #birdeatsbug-sdk {
      --distance-to-window-edge-vertical: 50px;
      --distance-to-window-edge-horizontal: 20px;
    }
    
    /* Override specific elements */
    #birdeatsbug-sdk .form-error {
      font-size: 1.2rem;
    }
    
    /* Change colors for dark theme */
    #birdeatsbug-sdk.dark {
      --button-primary-bg-color: #1976d2;
    }
  `;
  document.head.appendChild(customStyles);
  
  // Pass options
  if (window.birdeatsbug && 'setOptions' in window.birdeatsbug) {
    window.birdeatsbug.setOptions!(
        { publicAppId: 'faf02e48-84b7-4292-b76c-03d9342ba9aa',
          ui: {position: 'bottom-right',
               defaultButton : {icon: 'exclamation'},
               text: {defaultButton: 'Send Feedback'},
               watermark: false
          }
    });
  }
};

