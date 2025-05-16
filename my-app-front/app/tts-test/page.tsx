'use client';

import React from 'react';
import TTSTest from '../../components/tts-test';

export default function TTSTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">TTS Testing Page</h1>
      <p className="mb-6">
        This page allows you to test how the Text-to-Speech system processes different types of content.
        Click on the test buttons to hear how the TTS handles various special characters and formatting.
      </p>
      <TTSTest />
    </div>
  );
}
