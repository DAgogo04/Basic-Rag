import SettingPanel from '../components/SettingPanel'
import FileUploader from '../components/FileUploader'

export default function UploadPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold text-gray-900 font-[Poppins]">上传文档</h2>
      <SettingPanel />
      <FileUploader />
    </div>
  )
}
