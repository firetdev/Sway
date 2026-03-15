import { signal, html, render } from './sway.ts';

const likes = signal(0);

function LikeButton() {
  return html`
    <button>
      ❤️ ${likes}
    </button>
  `;
}

function App() {
  return html`
    <h1>Like Button</h1>
    ${LikeButton()}
  `;
}

render(App(), document.body);

document.body.addEventListener('click', () => {
  likes.value++;
});