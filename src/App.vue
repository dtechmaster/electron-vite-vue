<script setup lang="ts">
import PdfForm from './components/PdfForm.vue'
</script>

<template>
  <PdfForm />
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #app {
  height: 100%;
  background: #1e1e2e;
  font-family: 'メイリオ', Meiryo, 'MS Gothic', sans-serif;
  overflow-x: hidden;
}

#app {
  display: flex;
  flex-direction: column;
}
</style>
