import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/language_keyword/', // 注意：這裡必須前後都有斜線，且名稱要跟 GitHub Repo 一樣
})