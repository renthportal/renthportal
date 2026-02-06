'use client'
import { Star } from 'lucide-react'

const FavoriteStar = ({ active, onClick }) => (
  <button onClick={e => { e.stopPropagation(); onClick() }} className={`p-1.5 rounded-lg transition-all ${active ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-gray-400'}`}>
    <Heart className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
  </button>
)


export default FavoriteStar
