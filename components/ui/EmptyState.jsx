'use client'
import { Plus } from 'lucide-react'

const EmptyState = ({ icon: Icon, title, description, action, onboardingStep }) => (
  <div className="text-center py-8 lg:py-12">
    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Icon className="w-8 h-8 text-gray-400" /></div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 mb-4 max-w-sm mx-auto">{description}</p>
    {onboardingStep && (
      <div className="flex items-center justify-center gap-2 mb-4 text-sm text-blue-600 bg-blue-50 rounded-xl py-2 px-4 w-fit mx-auto">
        <AlertCircle className="w-4 h-4" />
        <span>{onboardingStep}</span>
      </div>
    )}
    {action}
  </div>
)


export default EmptyState
