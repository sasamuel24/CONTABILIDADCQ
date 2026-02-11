"""
Servicio para operaciones con Amazon S3.
Maneja upload de archivos y generación de URLs prefirmadas.
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError
from typing import BinaryIO, Optional
from core.config import settings
from core.logging import logger
from fastapi import HTTPException, status


class S3Service:
    """Servicio para interactuar con Amazon S3."""
    
    def __init__(self):
        """Inicializa el cliente S3 con credenciales desde settings."""
        try:
            # Configuración para presigned URLs
            s3_config = Config(
                signature_version='s3v4',
                region_name=settings.aws_region
            )
            
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
                config=s3_config
            )
            self.bucket = settings.s3_bucket
            logger.info(f"S3Service inicializado: bucket={self.bucket}, region={settings.aws_region}")
        except NoCredentialsError:
            logger.error("Credenciales de AWS no configuradas")
            raise
    
    def upload_fileobj(
        self,
        fileobj: BinaryIO,
        key: str,
        content_type: str = "application/octet-stream"
    ) -> dict:
        """
        Sube un archivo a S3.
        
        Args:
            fileobj: Objeto de archivo binario para subir
            key: Ruta/key del objeto en S3 (ej: "dev/facturas/{id}/file.pdf")
            content_type: MIME type del archivo
            
        Returns:
            dict con metadata: bucket, key, s3_uri, content_type, size_bytes
            
        Raises:
            HTTPException: Si falla la subida a S3
        """
        try:
            # Obtener tamaño del archivo
            fileobj.seek(0, 2)  # Ir al final
            size_bytes = fileobj.tell()
            fileobj.seek(0)  # Volver al inicio
            
            # Subir a S3
            self.s3_client.upload_fileobj(
                fileobj,
                self.bucket,
                key,
                ExtraArgs={
                    'ContentType': content_type,
                    # No usar ACL público
                }
            )
            
            logger.info(f"Archivo subido exitosamente a S3: s3://{self.bucket}/{key}")
            
            return {
                "bucket": self.bucket,
                "key": key,
                "s3_uri": f"s3://{self.bucket}/{key}",
                "content_type": content_type,
                "size_bytes": size_bytes
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error subiendo a S3: {error_code} - {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al subir archivo a S3: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado subiendo a S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al subir archivo a S3"
            )
    
    def presign_get_url(self, key: str, expires_in: int = 600) -> str:
        """
        Genera una URL prefirmada para descargar un objeto de S3.
        
        Args:
            key: Ruta del objeto en S3
            expires_in: Tiempo de expiración en segundos (default: 10 minutos)
            
        Returns:
            str: URL prefirmada para GET
            
        Raises:
            HTTPException: Si falla la generación de la URL
        """
        try:
            logger.info(f"Generando presigned URL para key: '{key}'")
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': key
                },
                ExpiresIn=expires_in
            )
            logger.info(f"URL prefirmada generada exitosamente (expira en {expires_in}s)")
            logger.debug(f"URL generada: {url[:100]}...")
            return url
            
        except ClientError as e:
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error generando URL prefirmada: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al generar URL de descarga: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado generando URL prefirmada: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al generar URL de descarga"
            )
    
    def get_file_content(self, key: str) -> bytes:
        """
        Descarga el contenido de un archivo desde S3.
        
        Args:
            key: Ruta del objeto en S3
            
        Returns:
            bytes: Contenido del archivo
            
        Raises:
            HTTPException: Si falla la descarga
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key=key
            )
            content = response['Body'].read()
            logger.info(f"Archivo descargado de S3: {key}")
            return content
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                logger.warning(f"Archivo no encontrado en S3: {key}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado en S3"
                )
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error descargando de S3: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al descargar archivo: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado descargando de S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al descargar archivo"
            )
    
    def get_file_with_metadata(self, key: str) -> tuple[bytes, str]:
        """
        Descarga el contenido de un archivo desde S3 junto con su content_type.
        
        Args:
            key: Ruta del objeto en S3
            
        Returns:
            tuple: (contenido_bytes, content_type)
            
        Raises:
            HTTPException: Si falla la descarga
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key=key
            )
            content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            logger.info(f"Archivo descargado de S3: {key} (content_type: {content_type})")
            return content, content_type
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                logger.warning(f"Archivo no encontrado en S3: {key}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado en S3"
                )
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error descargando de S3: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al descargar archivo: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado descargando de S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al descargar archivo"
            )
    
    def list_files_in_prefix(self, prefix: str) -> list[dict]:
        """
        Lista todos los archivos en S3 que coincidan con un prefijo.
        
        Args:
            prefix: Prefijo para buscar (ej: "dev/facturas/id-factura/pdf/")
            
        Returns:
            list: Lista de diccionarios con metadata de archivos
            
        Raises:
            HTTPException: Si falla la operación
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Extraer nombre del archivo desde la key
                    key = obj['Key']
                    filename = key.split('/')[-1]
                    
                    logger.info(f"Procesando archivo S3 - Key completa: '{key}', Filename: '{filename}'")
                    
                    # Generar URL prefirmada usando la Key completa sin modificar
                    download_url = self.presign_get_url(key, expires_in=600)
                    
                    files.append({
                        'key': key,
                        'filename': filename,
                        'size_bytes': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'download_url': download_url
                    })
            
            logger.info(f"Listados {len(files)} archivos con prefijo: {prefix}")
            return files
            
        except ClientError as e:
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error listando archivos en S3: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al listar archivos: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado listando archivos en S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al listar archivos"
            )
    
    def delete_file(self, key: str) -> bool:
        """
        Elimina un archivo de S3.
        
        Args:
            key: Ruta del objeto en S3 a eliminar
            
        Returns:
            bool: True si se eliminó exitosamente, False si no existía
            
        Raises:
            HTTPException: Si falla la operación
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket,
                Key=key
            )
            logger.info(f"Archivo eliminado de S3: {key}")
            return True
            
        except ClientError as e:
            error_msg = e.response.get('Error', {}).get('Message', 'Error desconocido')
            logger.error(f"Error eliminando archivo de S3: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al eliminar archivo: {error_msg}"
            )
        except Exception as e:
            logger.error(f"Error inesperado eliminando archivo de S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al eliminar archivo"
            )


# Instancia global del servicio S3
s3_service = S3Service()
