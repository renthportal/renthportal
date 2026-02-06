import Image from 'next/image'
import { LOGO_URL } from '@/lib/constants'

const Logo = ({ size = 'md' }) => {
  const sizes = { sm: 'h-6', md: 'h-8', lg: 'h-10', xl: 'h-14' }
  return <img src={LOGO_URL} alt="RENTH" className={sizes[size]} />
}

export default Logo
