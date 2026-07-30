'use client'

import React, { useEffect, useState, useRef } from 'react'
import { X, Send } from 'lucide-react'
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

export default function ChatBox({ recipientUsername, onClose }: ChatBoxProps) {
  const { user: currentUser } = useAuthStore()
  const [messages, setMessages] = useState<{ id: string; text: string; isMine: boolean }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [ourPrivateKey, setOurPrivateKey] = useState<CryptoKey | null>(null)
  const [theirPublicKey, setTheirPublicKey] = useState<string | null>(null)

  useEffect(() => {
    const initE2EE = async () => {
      if (!currentUser) return
      
      try {
        // 1. Get recipient public key
        const { data: profile } = await api.get(`/auth/users/${recipientUsername}`)
        if (!profile.public_key) {
          setError(`${recipientUsername} hasn't set up E2EE keys yet.`)
          setLoading(false)
          return
        }
        setTheirPublicKey(profile.public_key)

        // 2. Load our private key (or generate if none)
        let privKey = await loadPrivateKey()
        if (!privKey) {
          const keyPair = await generateKeyPair()
          privKey = keyPair.privateKey
          await savePrivateKey(privKey)
          const pubKeyBase64 = await exportPublicKey(keyPair.publicKey)
          // Save to server
          await api.post('/messages/keys', { public_key: pubKeyBase64 })
        }
        setOurPrivateKey(privKey)

        // 3. Fetch chat history
        const { data: history } = await api.get<MessageData[]>(`/messages/${recipientUsername}`)
        
        // Decrypt history
        const decryptedMsgs = await Promise.all(history.map(async (msg) => {
          let text = "[Unable to decrypt]"
          try {
            // We only need to decrypt if we have the private key and their public key.
            // If we sent it, it's encrypted with their public key. 
            // Wait, if we sent it, we encrypted it with THEIR public key, using OUR private key.
            // Wait, ECDH generates the same shared secret regardless of direction (ourPriv + theirPub == theirPriv + ourPub).
            // So we can decrypt both sent and received messages with the exact same shared key!
            text = await decryptMessage(msg.encrypted_content, msg.nonce, privKey!, profile.public_key)
          } catch (e) {
            console.error("Decryption failed for msg", msg.id)
          }
          return {
            id: msg.id,
            text,
            isMine: msg.sender_username === currentUser.username
          }
        }))

        setMessages(decryptedMsgs)
        setLoading(false)
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

      } catch (err) {
        console.error("Chat init failed", err)
        setError("Failed to initialize chat.")
        setLoading(false)
      }
    }
    initE2EE()
  }, [recipientUsername, currentUser])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !ourPrivateKey || !theirPublicKey) return

    const messageText = input.trim()
    setInput('') // optimistic clear

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
    } catch (err) {
      console.error("Send failed", err)
      setError("Failed to send message.")
    }
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col z-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-600 text-white flex justify-between items-center shrink-0">
        <h3 className="font-semibold text-sm">Chat with {recipientUsername}</h3>
        <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-md transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-[#090c10] flex flex-col gap-3">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm text-center p-4">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-500 text-sm text-center p-4">No messages yet. Send an encrypted greeting!</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${msg.isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-[#0d1117] border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="E2EE message..."
          className="flex-1 bg-slate-100 dark:bg-[#21262d] border border-slate-300 dark:border-slate-600 rounded-full px-4 py-1.5 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors dark:text-slate-200"
          disabled={loading || !!error}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || loading || !!error}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full p-2 flex items-center justify-center transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
