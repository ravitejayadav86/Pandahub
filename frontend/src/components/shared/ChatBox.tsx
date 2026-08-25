'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { X, Send, Lock, AlertCircle, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { 
  generateKeyPair, 
  exportPublicKey, 
  savePrivateKey, 
  loadPrivateKey, 
  encryptMessage, 
  decryptMessage 
} from '@/lib/crypto'

interface MessageData {
  id: string
  sender_id: string
  recipient_id: string
  encrypted_content: string
  nonce: string
  created_at: string
  sender_username: string
}

interface ChatBoxProps {
  recipientUsername: string
  onClose: () => void
}

type ChatState = 'loading' | 'ready' | 'no_recipient_key' | 'error'

export default function ChatBox({ recipientUsername, onClose }: ChatBoxProps) {
  const { user: currentUser } = useAuthStore()
  const [messages, setMessages] = useState<{ id: string; text: string; isMine: boolean }[]>([])
  const [input, setInput] = useState('')
  const [chatState, setChatState] = useState<ChatState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [ourPrivateKey, setOurPrivateKey] = useState<CryptoKey | null>(null)
  const [theirPublicKey, setTheirPublicKey] = useState<string | null>(null)

  const initE2EE = useCallback(async () => {
    if (!currentUser) return
    setChatState('loading')
    setErrorMsg(null)
    
    try {
      // 1. Get recipient profile + public key
      const { data: profile } = await api.get(`/auth/users/${recipientUsername}`)
      
      if (!profile.public_key) {
        // Recipient hasn't set up E2EE — show friendly message
        setChatState('no_recipient_key')
        return
      }
      setTheirPublicKey(profile.public_key)

      // 2. Load our private key from IndexedDB, or generate a fresh pair
      let privKey = await loadPrivateKey()
      if (!privKey) {
        const keyPair = await generateKeyPair()
        privKey = keyPair.privateKey
        await savePrivateKey(privKey)
        const pubKeyBase64 = await exportPublicKey(keyPair.publicKey)
        // Persist our public key to the server
        await api.post('/messages/keys', { public_key: pubKeyBase64 })
      }
      setOurPrivateKey(privKey)

      // 3. Fetch chat history and decrypt
      const { data: history } = await api.get<MessageData[]>(`/messages/${recipientUsername}`)
      
      const decryptedMsgs = await Promise.all(history.map(async (msg) => {
        let text = '🔒 [Unable to decrypt]'
        try {
          text = await decryptMessage(msg.encrypted_content, msg.nonce, privKey!, profile.public_key)
        } catch {
          // silently keep placeholder
        }
        return {
          id: msg.id,
          text,
          isMine: msg.sender_username === currentUser.username
        }
      }))

      setMessages(decryptedMsgs)
      setChatState('ready')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    } catch (err: any) {
      console.error('Chat init failed', err)
      const detail = err?.response?.data?.detail || 'Failed to initialize chat.'
      setErrorMsg(detail)
      setChatState('error')
    }
  }, [recipientUsername, currentUser])

  useEffect(() => {
    initE2EE()
  }, [initE2EE])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !ourPrivateKey || !theirPublicKey || chatState !== 'ready') return

    const messageText = input.trim()
    setInput('')

    try {
      const { ciphertext, iv } = await encryptMessage(messageText, ourPrivateKey, theirPublicKey)
      
      const { data } = await api.post(`/messages/${recipientUsername}`, {
        encrypted_content: ciphertext,
        nonce: iv
      })

      setMessages(prev => [...prev, {
        id: data.id,
        text: messageText,
        isMine: true
      }])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err: any) {
      console.error('Send failed', err)
      const detail = err?.response?.data?.detail || 'Failed to send message.'
      setErrorMsg(detail)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 h-[430px] glass-panel rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans border border-[var(--glass-border)] animate-fade-in-up">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-md text-white flex justify-between items-center shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 opacity-90" />
          <h3 className="font-semibold text-sm">Chat with {recipientUsername}</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-md transition-colors" aria-label="Close chat">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: 'var(--glass-bg-1)' }}>
        {chatState === 'loading' && (
          <div className="flex-1 flex flex-col justify-center items-center gap-3 h-full">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Setting up secure channel…</p>
          </div>
        )}

        {chatState === 'no_recipient_key' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              E2EE Not Set Up
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong>{recipientUsername}</strong> hasn&apos;t set up end-to-end encryption keys yet. Ask them to open a chat first to auto-initialize their keys.
            </p>
          </div>
        )}

        {chatState === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm text-red-500 font-semibold">Connection failed</p>
            <p className="text-xs text-slate-500">{errorMsg}</p>
            <button
              onClick={initE2EE}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 transition-colors mt-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {chatState === 'ready' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Lock className="w-8 h-8 text-slate-400 opacity-60" />
            <p className="text-sm text-slate-400">
              No messages yet. Your conversation is end-to-end encrypted.
            </p>
          </div>
        )}

        {chatState === 'ready' && messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
              msg.isMine 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-blue-500/20' 
                : 'glass-card text-slate-800 dark:text-slate-200 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-[var(--glass-border)] flex gap-2 shrink-0" style={{ background: 'var(--glass-bg-3)' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatState === 'ready' ? 'Send encrypted message…' : 'Chat unavailable'}
          className="flex-1 glass-input rounded-full px-4 py-1.5 text-sm outline-none transition-colors"
          disabled={chatState !== 'ready'}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || chatState !== 'ready'}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full p-2 flex items-center justify-center transition-colors shadow-sm"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
