'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, compressImageToBlob } from '@/lib/supabase'
import {
  Wrench, Play, CheckCircle2, Clock, MapPin, Phone, Building2, Package,
  Camera, Upload, Navigation, AlertTriangle, ChevronRight, RefreshCw,
  X, Save, Car, Timer
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700'
}

const TechnicianTasksPage = ({ user, showToast }) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  
  // Start modal
  const [showStartModal, setShowStartModal] = useState(false)
  const [startingTask, setStartingTask] = useState(null)
  const [startKm, setStartKm] = useState('')
  const [startingLocation, setStartingLocation] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  
  // Complete modal
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completingTask, setCompletingTask] = useState(null)
  const [completeForm, setCompleteForm] = useState({
    resolution_notes: '',
    is_user_fault: false,
    fault_description: '',
    parts_used: '',
    end_km: '',
    labor_hours: '',
    parts_cost: '',
    labor_cost: '',
    is_warranty: false,
    customer_name: ''
  })
  const [photos, setPhotos] = useState([])
  const [signature, setSignature] = useState(null)
  const [saving, setSaving] = useState(false)
  
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          company:companies(id, name, phone, address, city),
          fleet:fleet(id, name, serial_number)
        `)
        .eq('assigned_to', user.id)
        .in('status', ['ASSIGNED', 'IN_PROGRESS'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setTasks(data || [])
      
      // Aktif task varsa set et
      const inProgress = data?.find(t => t.status === 'IN_PROGRESS')
      setActiveTask(inProgress || null)
    } catch (err) {
      console.error('Load tasks error:', err)
      showToast('Görevler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [user, showToast])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Konum al
  const getLocation = () => {
    setGettingLocation(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStartingLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          })
          setGettingLocation(false)
        },
        (err) => {
          console.error('Location error:', err)
          showToast('Konum alınamadı', 'error')
          setGettingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      showToast('Konum desteği yok', 'error')
      setGettingLocation(false)
    }
  }

  // Servisi başlat
  const handleStartService = async () => {
    if (!startingTask) return
    setSaving(true)
    try {
      // Konum al (henüz alınmadıysa)
      let location = startingLocation
      if (!location && navigator.geolocation) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          )
        })
      }

      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString(),
          start_lat: location?.lat || null,
          start_lng: location?.lng || null,
          start_km: startKm ? parseInt(startKm) : null
        })
        .eq('id', startingTask.id)

      if (error) throw error
      showToast('Servis başlatıldı', 'success')
      setShowStartModal(false)
      setStartingTask(null)
      setStartKm('')
      setStartingLocation(null)
      loadTasks()
    } catch (err) {
      console.error('Start error:', err)
      showToast('Başlatma başarısız', 'error')
    }
    setSaving(false)
  }

  // Fotoğraf ekle
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    for (const file of files) {
      try {
        const compressed = await compressImageToBlob(file, 1200, 0.8)
        const reader = new FileReader()
        reader.onloadend = () => {
          setPhotos(prev => [...prev, reader.result])
        }
        reader.readAsDataURL(compressed)
      } catch (err) {
        showToast('Fotoğraf yüklenemedi', 'error')
      }
    }
  }

  // İmza canvas
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      setSignature(canvas.toDataURL('image/png'))
    }
  }

  const clearSignature = () => {
    setSignature(null)
    initCanvas()
  }

  // Servisi tamamla
  const handleCompleteService = async () => {
    if (!completingTask || !completeForm.resolution_notes) {
      showToast('Yapılan işlemleri yazın', 'error')
      return
    }
    setSaving(true)
    try {
      // Konum al
      let endLocation = null
      if (navigator.geolocation) {
        endLocation = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          )
        })
      }

      // KM hesapla
      const startKmVal = completingTask.start_km || 0
      const endKmVal = completeForm.end_km ? parseInt(completeForm.end_km) : 0
      const totalKm = endKmVal > startKmVal ? endKmVal - startKmVal : 0

      // Maliyet hesapla
      const partsCost = parseFloat(completeForm.parts_cost) || 0
      const laborCost = parseFloat(completeForm.labor_cost) || 0
      const totalCost = partsCost + laborCost

      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'RESOLVED',
          completed_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
          end_lat: endLocation?.lat || null,
          end_lng: endLocation?.lng || null,
          end_km: endKmVal || null,
          total_km: totalKm || null,
          resolution_notes: completeForm.resolution_notes,
          is_user_fault: completeForm.is_user_fault,
          fault_description: completeForm.is_user_fault ? completeForm.fault_description : null,
          parts_used: completeForm.parts_used || null,
          labor_hours: completeForm.labor_hours ? parseFloat(completeForm.labor_hours) : null,
          parts_cost: partsCost,
          labor_cost: laborCost,
          total_cost: totalCost,
          is_warranty: completeForm.is_warranty,
          is_billable: !completeForm.is_warranty,
          photos: photos.length > 0 ? photos : null,
          customer_signature: signature || null,
          customer_name: completeForm.customer_name || null
        })
        .eq('id', completingTask.id)

      if (error) throw error
      showToast('Servis tamamlandı', 'success')
      setShowCompleteModal(false)
      setCompletingTask(null)
      setCompleteForm({
        resolution_notes: '',
        is_user_fault: false,
        fault_description: '',
        parts_used: '',
        end_km: '',
        labor_hours: '',
        parts_cost: '',
        labor_cost: '',
        is_warranty: false,
        customer_name: ''
      })
      setPhotos([])
      setSignature(null)
      loadTasks()
    } catch (err) {
      console.error('Complete error:', err)
      showToast('Tamamlama başarısız', 'error')
    }
    setSaving(false)
  }

  const openCompleteModal = (task) => {
    setCompletingTask(task)
    setShowCompleteModal(true)
    setTimeout(initCanvas, 100)
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'

  if (loading) return <div className="p-4"><SkeletonCards count={3} /></div>

  const assignedTasks = tasks.filter(t => t.status === 'ASSIGNED')
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS')

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Servis Görevlerim</h2>
          <p className="text-sm text-gray-500">{tasks.length} aktif görev</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={loadTasks}>Yenile</Button>
      </div>

      {/* Active Task Banner */}
      {inProgressTasks.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Devam Eden Servis</p>
                <p className="text-sm text-blue-700">{inProgressTasks[0].ticket_number} - {inProgressTasks[0].company?.name}</p>
              </div>
            </div>
            <Button variant="primary" icon={CheckCircle2} onClick={() => openCompleteModal(inProgressTasks[0])}>
              Tamamla
            </Button>
          </div>
        </Card>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <EmptyState icon={Wrench} title="Görev yok" description="Şu an atanmış servis görevi bulunmuyor." />
      ) : (
        <div className="space-y-4">
          {/* In Progress */}
          {inProgressTasks.map(task => (
            <Card key={task.id} className="overflow-hidden ring-2 ring-blue-400">
              <div className="p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 text-xs font-bold rounded bg-blue-500 text-white">DEVAM EDİYOR</span>
                  <span className="font-mono text-sm font-bold">{task.ticket_number}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority === 'URGENT' ? '🔴 ACİL' : task.priority === 'HIGH' ? '🟠 Yüksek' : task.priority}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{task.company?.name}</span>
                    {task.company?.phone && (
                      <a href={`tel:${task.company.phone}`} className="text-blue-600 text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Ara
                      </a>
                    )}
                  </div>
                  
                  {task.machine_type && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{task.machine_type} {task.machine_serial && `(${task.machine_serial})`}</span>
                    </div>
                  )}

                  {task.company?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                      <span className="text-sm text-gray-600">{task.company.address}, {task.company.city}</span>
                    </div>
                  )}

                  <p className="text-sm text-gray-700 bg-white p-2 rounded">{task.description}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Başladı: {formatTime(task.started_at)}</span>
                    {task.start_km && <span>Başlangıç KM: {task.start_km}</span>}
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="primary" icon={CheckCircle2} className="w-full" onClick={() => openCompleteModal(task)}>
                    Servisi Tamamla
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Assigned */}
          {assignedTasks.length > 0 && (
            <>
              <p className="text-sm font-medium text-gray-500 mt-4">Bekleyen Görevler ({assignedTasks.length})</p>
              {assignedTasks.map(task => (
                <Card key={task.id} className={`overflow-hidden ${task.priority === 'URGENT' ? 'ring-2 ring-red-300' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{task.ticket_number}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority === 'URGENT' ? '🔴 ACİL' : task.priority === 'HIGH' ? '🟠 Yüksek' : task.priority}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(task.created_at)}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{task.company?.name}</span>
                      </div>
                      
                      {task.machine_type && (
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{task.machine_type}</span>
                        </div>
                      )}

                      <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {task.company?.phone && (
                        <a href={`tel:${task.company.phone}`} className="flex-1">
                          <Button variant="outline" icon={Phone} className="w-full" size="sm">Ara</Button>
                        </a>
                      )}
                      <Button 
                        variant="primary" 
                        icon={Play} 
                        className="flex-1"
                        onClick={() => { setStartingTask(task); setShowStartModal(true) }}
                        disabled={inProgressTasks.length > 0}
                      >
                        Başlat
                      </Button>
                    </div>
                    {inProgressTasks.length > 0 && (
                      <p className="text-xs text-amber-600 mt-2 text-center">Önce devam eden servisi tamamlayın</p>
                    )}
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Start Modal */}
      <Modal isOpen={showStartModal} onClose={() => setShowStartModal(false)} title="Servisi Başlat" size="sm">
        <div className="p-6 space-y-4">
          {startingTask && (
            <>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{startingTask.ticket_number}</p>
                <p className="text-sm text-gray-600">{startingTask.company?.name}</p>
                <p className="text-sm text-gray-500">{startingTask.machine_type}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Araç KM</label>
                <Input
                  type="number"
                  value={startKm}
                  onChange={(e) => setStartKm(e.target.value)}
                  placeholder="Örn: 45230"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-500" />
                {startingLocation ? (
                  <span className="text-sm text-blue-700">
                    📍 Konum alındı: {startingLocation.lat.toFixed(4)}, {startingLocation.lng.toFixed(4)}
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={getLocation} loading={gettingLocation}>
                    Konum Al
                  </Button>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowStartModal(false)}>İptal</Button>
                <Button variant="primary" className="flex-1" icon={Play} onClick={handleStartService} loading={saving}>
                  Servisi Başlat
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Servisi Tamamla" size="lg">
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {completingTask && (
            <>
              {/* Task Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{completingTask.ticket_number}</p>
                <p className="text-sm text-gray-600">{completingTask.company?.name} - {completingTask.machine_type}</p>
                <p className="text-xs text-gray-400">Başladı: {formatTime(completingTask.started_at)}</p>
              </div>

              {/* Resolution Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yapılan İşlemler *</label>
                <Textarea
                  value={completeForm.resolution_notes}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, resolution_notes: e.target.value }))}
                  placeholder="Yapılan işlemleri detaylı yazın..."
                  rows={4}
                />
              </div>

              {/* User Fault */}
              <div className="p-3 bg-amber-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeForm.is_user_fault}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, is_user_fault: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-amber-800">Kullanıcı Hatası</span>
                </label>
                {completeForm.is_user_fault && (
                  <Textarea
                    value={completeForm.fault_description}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, fault_description: e.target.value }))}
                    placeholder="Hatayı açıklayın..."
                    rows={2}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Parts Used */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kullanılan Parçalar</label>
                <Textarea
                  value={completeForm.parts_used}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, parts_used: e.target.value }))}
                  placeholder="Yağ, filtre, conta vb..."
                  rows={2}
                />
              </div>

              {/* KM & Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş KM</label>
                  <Input
                    type="number"
                    value={completeForm.end_km}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, end_km: e.target.value }))}
                    placeholder="Örn: 45280"
                  />
                  {completingTask.start_km && completeForm.end_km && (
                    <p className="text-xs text-blue-600 mt-1">
                      Toplam: {parseInt(completeForm.end_km) - completingTask.start_km} km
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İşçilik (saat)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={completeForm.labor_hours}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, labor_hours: e.target.value }))}
                    placeholder="Örn: 2.5"
                  />
                </div>
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parça Maliyeti (₺)</label>
                  <Input
                    type="number"
                    value={completeForm.parts_cost}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, parts_cost: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İşçilik Maliyeti (₺)</label>
                  <Input
                    type="number"
                    value={completeForm.labor_cost}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, labor_cost: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Warranty */}
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={completeForm.is_warranty}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, is_warranty: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">Garanti kapsamında (faturalanmaz)</span>
              </label>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fotoğraflar</label>
                <div className="flex flex-wrap gap-2">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative w-20 h-20">
                      <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500">
                    <Camera className="w-6 h-6 text-gray-400" />
                    <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri İmzası</label>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={150}
                    className="w-full touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Input
                    placeholder="İmza sahibinin adı"
                    value={completeForm.customer_name}
                    onChange={(e) => setCompleteForm(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="flex-1 mr-2"
                  />
                  <Button variant="ghost" size="sm" onClick={clearSignature}>Temizle</Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setShowCompleteModal(false)}>İptal</Button>
                <Button variant="primary" className="flex-1" icon={CheckCircle2} onClick={handleCompleteService} loading={saving}>
                  Servisi Tamamla
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default TechnicianTasksPage
