import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PdfReaderPage } from './pages/PdfReaderPage';
import { QrScannerPage } from './pages/QrScannerPage';
import { QrGeneratorPage } from './pages/QrGeneratorPage';
import { PdfManagerPage } from './pages/PdfManagerPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/reader" element={<PdfReaderPage />} />
              <Route path="/reader/:id" element={<PdfReaderPage />} />
              <Route path="/scanner" element={<QrScannerPage />} />
              <Route path="/generator" element={<QrGeneratorPage />} />
              <Route path="/documents" element={<PdfManagerPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
