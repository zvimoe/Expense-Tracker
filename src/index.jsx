import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import App from './App.jsx';
import './styles/index.css';

// Register all Chart.js components once at the app root
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const root = createRoot(document.getElementById('root'));
root.render(<App />);
