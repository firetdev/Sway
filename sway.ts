// Sway 1.1 (Mar 15 2026)
// A tiny UI library by firetdev


// Variable which can temporarily hold the currently running effect function
let currentEffect: (() => void) | null = null;

// A "signal": a variable that can trigger updates when it changes
export function signal<T>(value: T) {
  // Functions (models) that depend on this signal will be stored here
  const subscribers = new Set<() => void>();

  return {
    get value() {
      // If there's a currently running function, add it to the subscribers
      if (currentEffect) subscribers.add(currentEffect);
      return value;
    },

    set value(v: T) {
      value = v;
      // Re-render all subscribers when the value changes
      subscribers.forEach(fn => fn());
    }
  };
}

// Basically a proxy for calling a function. Because currentEffect is set to the function we want to run,
// any signals used within the function will know to subscribe to it.
function effect(fn: () => void) {
  currentEffect = fn;
  fn();
  currentEffect = null;
}

// Model. Splits, for example, <div>${value}</div> into ["<div>", "</div>"] and [value]
export function html(strings: TemplateStringsArray, ...values: any[]) {
  return { strings, values };
}

// Renders a model into a container element
export function render(template: any, container: HTMLElement) {
  const { strings, values } = template;
  
  // Create the HTML string with markers
  let htmlString = strings.reduce((acc: any, str: any, i: any) => {
    return acc + str + (i < values.length ? `__sway_marker_${i}__` : '');
  }, '');

  // Render
  container.innerHTML = htmlString;

  // Fix Attributes and Events
  // Look for any element that has an attribute containing a marker
  const allElements = container.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.value.includes('__sway_marker_')) {
        const index = parseInt(attr.value.match(/\d+/)![0]);
        const value = values[index];

        // Handle Event Listeners (onClick, onChange)
        if (attr.name.startsWith('on')) {
          const eventName = attr.name.toLowerCase().substring(2);
          el.addEventListener(eventName, value);
          el.removeAttribute(attr.name);
        } 
        // Handle Reactive Attributes (value, style)
        else {
          effect(() => {
            const val = (value && typeof value === 'object' && 'value' in value) 
                        ? value.value : value;
            (el as any)[attr.name] = val;
            el.setAttribute(attr.name, val);
          });
        }
      }
    }
  });

  // Goes through every branch of the DOM, with the container as the root, and looks for markers
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_COMMENT
  );

  let index = 0;
  let node;

  while ((node = walker.nextNode())) {
    const value = values[index];
    const parent = node.parentNode!;

    // If it's a signal or text
    if (value && typeof value === 'object' && 'value' in value) {  // It exists, is an object, and has a "value" property
      const textNode = document.createTextNode('');
      parent.replaceChild(textNode, node);

      effect(() => {
        textNode.textContent = value.value;
      });
    }

    // If it's a nested model
    else if (value && value.strings && value.values) {  // It exists and has "strings" and "values" properties
      const placeholder = document.createElement('span');
      parent.replaceChild(placeholder, node);

      render(value, placeholder);
    }

    // If it's a plain value
    else {
      const textNode = document.createTextNode(String(value));
      parent.replaceChild(textNode, node);
    }

    index++;
  }
}