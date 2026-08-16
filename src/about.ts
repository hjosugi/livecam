import './styles.css';
import './about.css';

const year = document.querySelector<HTMLElement>('#year');
if (year) year.textContent = String(new Date().getFullYear());
