// Sway 1.4 (Mar 15 2026)
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

  // Create HTML string with markers
  const htmlString = strings.reduce(
    (acc: string, str: string, i: number) => acc + str + (i < values.length ? `<!--sway_marker_${i}-->` : ''),
    ''
  );

  container.innerHTML = htmlString;

  // Fix Attributes and Events
  container.querySelectorAll('*').forEach(el => {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (!attr.value.includes('<!--sway_marker_')) continue;

      const index = parseInt(attr.value.match(/\d+/)![0]);
      const value = values[index];

      if (attr.name.startsWith('on')) {
        const eventName = attr.name.slice(2).toLowerCase();
        el.addEventListener(eventName, value);
        el.removeAttribute(attr.name);
      } else {
        effect(() => {
          const val = (value && typeof value === 'object' && 'value' in value) ? value.value : value;
          (el as any)[attr.name] = val;
        });
      }
    }
  });

  // Find all markers
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const markers: Comment[] = [];
  let node;
  while ((node = walker.nextNode())) {
    markers.push(node as Comment);
  }

  // Replace markers in DOM
  markers.forEach(node => {
    const match = node.nodeValue!.match(/\d+/);
    if (!match) return; 
    
    const index = parseInt(match[0], 10);
    const value = values[index];
    const parent = node.parentNode!;

    if (value && typeof value === 'object' && 'value' in value) {
      const textNode = document.createTextNode('');
      parent.replaceChild(textNode, node);
      effect(() => {
        textNode.textContent = value.value;
      });
    } else if (Array.isArray(value)) {
      const listContainer = document.createElement('div');
      parent.replaceChild(listContainer, node);
      effect(() => {
        listContainer.innerHTML = '';
        value.forEach(item => {
          console.log(item);
          const child = document.createElement('div');
          listContainer.appendChild(child);
          render(item, child);
        });
      });
    } else if (value && value.strings && value.values) {
      const placeholder = document.createElement('div');
      parent.replaceChild(placeholder, node);
      render(value, placeholder);
    } else {
      parent.replaceChild(document.createTextNode(String(value)), node);
    }
  });
}