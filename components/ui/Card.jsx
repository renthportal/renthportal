'use client'

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)


export default Card
