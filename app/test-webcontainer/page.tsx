'use client'

import React, { useState, useEffect, useRef } from 'react'
import { WebContainer } from '@webcontainer/api'
import { logger } from '@/lib/logger'

export default function TestWebContainer() {
  const [status, setStatus] = useState<string>('Initializing...')
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const webcontainerRef = useRef<WebContainer | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Boot WebContainer and run test
  useEffect(() => {
    async function bootWebContainer() {
      try {
        // Clear previous state
        setStatus('Booting WebContainer...')
        setOutput('')
        setError(null)
        setUrl(null)

        // Boot WebContainer
        logger.info('Booting WebContainer...')
        const webcontainer = await WebContainer.boot()
        webcontainerRef.current = webcontainer
        
        if (!isMounted.current) return
        setStatus('WebContainer booted successfully!')

        // Define minimal files for testing
        const files = {
          'index.js': {
            file: {
              contents: `
                console.log('Hello from WebContainer!');
                const http = require('http');
                const server = http.createServer((req, res) => {
                  res.writeHead(200, { 'Content-Type': 'text/html' });
                  res.end('<h1>Hello from WebContainer!</h1><p>If you see this, WebContainers are working correctly!</p>');
                });
                server.listen(8080);
                console.log('Server running at http://localhost:8080/');
              `
            }
          },
          'package.json': {
            file: {
              contents: JSON.stringify({
                name: 'webcontainer-test',
                version: '1.0.0',
                description: 'Testing WebContainers',
                main: 'index.js',
                type: 'commonjs'
              }, null, 2)
            }
          }
        }

        // Mount files
        setStatus('Mounting files...')
        logger.info('Mounting files to WebContainer:', Object.keys(files))
        await webcontainer.mount(files)
        
        if (!isMounted.current) return
        setStatus('Files mounted successfully!')

        // Start the server
        setStatus('Starting server...')
        const process = await webcontainer.spawn('node', ['index.js'])
        
        // Collect output
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              if (!isMounted.current) return
              setOutput(prev => prev + data + '\n')
              logger.debug('WebContainer output:', data)
            }
          })
        )

        // Wait for server to be ready
        setStatus('Waiting for server to be ready...')
        try {
          const serverUrl = await webcontainer.openUrl(8080)
          if (!isMounted.current) return
          setUrl(serverUrl)
          setStatus('Server is running!')
        } catch (openUrlError) {
          if (!isMounted.current) return
          setError(`Failed to open URL: ${openUrlError instanceof Error ? openUrlError.message : String(openUrlError)}`)
          setStatus('Error opening URL')
        }
      } catch (bootError) {
        if (!isMounted.current) return
        logger.error('WebContainer boot error:', bootError)
        setError(`Failed to boot WebContainer: ${bootError instanceof Error ? bootError.message : String(bootError)}`)
        setStatus('Error')
      }
    }

    bootWebContainer()

    // Cleanup on unmount
    return () => {
      if (webcontainerRef.current) {
        logger.info('Cleaning up WebContainer...')
        // WebContainer API doesn't have a direct terminate method,
        // but we can reset our reference to allow garbage collection
        webcontainerRef.current = null
      }
    }
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">WebContainer Test Page</h1>
      
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">Status</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            status === 'Error' ? 'bg-red-500' : 
            status === 'Server is running!' ? 'bg-green-500' : 
            'bg-yellow-500 animate-pulse'
          }`}></div>
          <p>{status}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-300 rounded bg-red-50 text-red-800">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {url && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Preview</h2>
          <div className="border rounded overflow-hidden h-96">
            <iframe 
              src={url} 
              className="w-full h-full"
              title="WebContainer Preview"
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Server URL: <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{url}</a>
          </p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Console Output</h2>
        <pre className="p-4 bg-black text-green-400 rounded font-mono text-sm h-48 overflow-auto">
          {output || 'Waiting for output...'}
        </pre>
      </div>

      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">Test Files</h2>
        <div className="mb-4">
          <h3 className="font-medium mb-1">index.js</h3>
          <pre className="p-3 bg-gray-100 rounded text-sm overflow-auto">
{`console.log('Hello from WebContainer!');
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Hello from WebContainer!</h1><p>If you see this, WebContainers are working correctly!</p>');
});
server.listen(8080);
console.log('Server running at http://localhost:8080/');`}
          </pre>
        </div>
        <div>
          <h3 className="font-medium mb-1">package.json</h3>
          <pre className="p-3 bg-gray-100 rounded text-sm overflow-auto">
{`{
  "name": "webcontainer-test",
  "version": "1.0.0",
  "description": "Testing WebContainers",
  "main": "index.js",
  "type": "commonjs"
}`}
          </pre>
        </div>
      </div>

      <div className="text-sm text-gray-600 mt-8">
        <p>
          This page tests WebContainers directly with minimal configuration.
          If you see "Server is running!" and the preview shows the hello message, WebContainers are working correctly.
        </p>
      </div>
    </div>
  )
}
