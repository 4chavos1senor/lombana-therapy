
# Imagen base de Node.js 24
FROM node:24-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar el código del proyecto
COPY . .

# Puerto utilizado por Lombana Therapy
EXPOSE 3000

# Ejecutar sin privilegios de administrador
USER node

# Iniciar el servidor
CMD ["npm", "start"]
