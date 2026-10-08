-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: localhost    Database: payrollhub
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_10_07_060246_create_personal_access_tokens_table',1),(5,'2026_10_07_060300_create_payrolls_table',1),(6,'2026_10_07_070000_add_details_to_payrolls_table',1),(7,'2026_10_07_080000_update_role_column_in_users_table',2);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payrolls`
--

DROP TABLE IF EXISTS `payrolls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payrolls` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `row_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employee_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `join_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_unit` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `period` char(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `basic_salary` decimal(15,2) NOT NULL DEFAULT '0.00',
  `allowance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `deduction` decimal(15,2) NOT NULL DEFAULT '0.00',
  `take_home_pay` decimal(15,2) NOT NULL DEFAULT '0.00',
  `bank_account` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payrolls_nik_period` (`nik`,`period`),
  KEY `idx_payrolls_employee_name` (`employee_name`),
  KEY `idx_payrolls_province` (`province`),
  KEY `idx_payrolls_period` (`period`),
  KEY `idx_payrolls_school_unit` (`school_unit`),
  KEY `idx_payrolls_position` (`position`),
  KEY `idx_payrolls_bank_name` (`bank_name`)
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payrolls`
--

LOCK TABLES `payrolls` WRITE;
/*!40000 ALTER TABLE `payrolls` DISABLE KEYS */;
INSERT INTO `payrolls` VALUES (7,'109','FEBRI HIDAYAT',NULL,'1 September 2026',NULL,'DKI JAKARTA','Salemba (Pusat)','2026-08',5721000.00,0.00,0.00,5721000.00,'2098199007','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(8,'116','MUHAMAD FERIANSAH','Cleaning Service','18 Agustus 2026',NULL,'DKI JAKARTA','Sekolah Rakyat Menengah Atas 10 Jakarta Selatan','2026-08',5721000.00,0.00,0.00,5721000.00,'2098393515','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(9,'660','RUDI SAPUTRA','Cleaning Service','25 Juli 2026','1213131111910001','SUMATERA UTARA','Sekolah Rakyat Menengah Atas 30 Padang Sidempuan','2026-08',3159000.00,0.00,0.00,3159000.00,'2097700845','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(10,'104','SRI MULYATI','Cleaning Service','27 Agustus 2026',NULL,'BANTEN','Sekolah Rakyat Menengah Atas 34 Lebak','2026-08',3085000.00,0.00,0.00,3085000.00,'2098476572','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(11,'106','AGUSMAN','Cleaning Service',NULL,'1771021208770010','BENGKULU','Sekolah Rakyat Menengah Atas 6 Bengkulu','2026-08',2811000.00,0.00,0.00,2811000.00,'2098397225','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(12,'113','VERNANDO DIKI SANJAYA','Wali Asuh','10 Agustus 2026',NULL,'DKI JAKARTA','Sekolah Rakyat Menengah Atas 9 Jakarta Timur','2026-08',5721000.00,0.00,0.00,5721000.00,'1851247341','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(13,'661','WULANDARI','Juru Masak','30 Juli 2026',NULL,'SUMATERA UTARA','Sekolah Rakyat Menengah Pertama 1 Deli Serdang','2026-08',3159000.00,0.00,0.00,3159000.00,'2098331285','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(14,'662','YULIA SARI','Juru Masak','30 Juli 2026','1207245102930001','SUMATERA UTARA','Sekolah Rakyat Menengah Pertama 1 Deli Serdang','2026-08',3159000.00,0.00,0.00,3159000.00,'423501003191508','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(15,'186','IRFAN PRIANSYAH','Wali Asuh','13 Juli 2026',NULL,'JAWA BARAT','Sekolah Rakyat Menengah Pertama 10 Bogor','2026-08',3433000.00,0.00,0.00,3433000.00,'2101495110','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(16,'187','MUHAMMAD NAJMI HAQQONI','Wali Asuh','13 Juli 2026',NULL,'JAWA BARAT','Sekolah Rakyat Menengah Pertama 10 Bogor','2026-08',3433000.00,0.00,0.00,3433000.00,'2102849716','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(17,'188','TIAR MULYANA','Wali Asuh','13 Juli 2026','3201196912020001','JAWA BARAT','Sekolah Rakyat Menengah Pertama 10 Bogor','2026-08',3433000.00,0.00,0.00,3433000.00,'2102113607','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(18,'254','AMIN MUNTOHAR','Cleaning Service','01 Agustus 2026',NULL,'JAWA TENGAH','Sekolah Rakyat Menengah Pertama 13 Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'1730016049034','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(19,'160','EEN SUHAENI','Cleaning Service','1 September 2026','3210076302840061','JAWA BARAT','Sekolah Rakyat Menengah Pertama 34 Majalengka','2026-08',3433000.00,0.00,0.00,3433000.00,'2103141191','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(20,'191','AMIN MUNTOHIR','Cleaning Service','1 Agustus 2026','3302200306870001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'2095188453','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(21,'192','ANDIVA KASIH ANGGORO PUTRA','Cleaning Service','1 Agustus 2026','3303063110020001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'0975173984','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(22,'193','ARINI RISSALINA','Cleaning Service','1 Agustus 2026','3302255008990001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'1341762478','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(23,'209','NAHAR AZHARRUL ZAIN','Wali Asuh','1 September 2026','3302112809990001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'2103125351','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(24,'210','RASTYA SEKAR FADIYAH','Wali Asuh','1 September 2026','3302104203990002','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Banyumas','2026-08',2230000.00,0.00,0.00,2230000.00,'2101591573','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(25,'432','IMAM BUDIANTO','Tata Usaha','24 Agustus 2026','6304020412940001','KALIMANTAN SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Barito Kuala','2026-08',3706000.00,0.00,0.00,3706000.00,'2098650020','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(26,'3','PONISYAH','Juru Masak','15 Juli','1111094402780001','ACEH','Sekolah Rakyat Terintegrasi 1 Kabupaten Bireuen','2026-08',3907000.00,0.00,0.00,3907000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(27,'181','SITI NURKHOLILAH','Juru Masak','01 Agustus 2026',NULL,'JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Bogor (SRMA)','2026-08',3433000.00,0.00,0.00,3433000.00,'2112021328','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(28,'182','YENI IESMANAWATI','Wali Asuh','06 Agustus 2026',NULL,'JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Bogor (SRMA)','2026-08',3433000.00,0.00,0.00,3433000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(29,'228','DHECA PUTRI AMELIA','Cleaning Service',NULL,'3329155512070008','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Brebes','2026-08',2230000.00,0.00,0.00,2230000.00,NULL,NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(30,'244','NANING ARIYANI','Tata Usaha','11 Juli','3301144511930003','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Cilacap','2026-08',2230000.00,0.00,0.00,2230000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(31,'138','MUHAMMAD ARIF RAFI','Wali Asuh','1 September 2026','3274030206000014','JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Cirebon','2026-08',3433000.00,0.00,0.00,3433000.00,'2100871902','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(32,'638','HERWANTO','Cleaning Service','4 agustus',NULL,'SUMATERA SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Empat Lawang','2026-08',3836000.00,0.00,0.00,3836000.00,'2098554100','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(33,'639','NYOMAN PRANATA','Cleaning Service','4 agustus','1611040806930004','SUMATERA SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Empat Lawang','2026-08',3836000.00,0.00,0.00,3836000.00,'2099855968','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(34,'640','SANDIKA','Cleaning Service','4 agustus','1611062805060003','SUMATERA SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Empat Lawang','2026-08',3836000.00,0.00,0.00,3836000.00,'480001044394532','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(35,'641','TIKA ARIANI','Cleaning Service','4 agustus','1611045512960002','SUMATERA SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Empat Lawang','2026-08',3836000.00,0.00,0.00,3836000.00,'2107332624','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(36,'642','SELIN KARPITA','Juru Masak','4 agustus',NULL,'SUMATERA SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Empat Lawang','2026-08',3836000.00,0.00,0.00,3836000.00,'2106956075','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(37,'261','MUHAMMAD TEDY SUSIAMTO','Cleaning Service','1 September 2026','3525090401980001','JAWA TIMUR','Sekolah Rakyat Terintegrasi 1 Kabupaten Gresik','2026-08',3759000.00,0.00,0.00,3759000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:49:17'),(38,'262','SHOFIYATUR ROSYIDAH','Cleaning Service','1 September 2026','3525126011860003','JAWA TIMUR','Sekolah Rakyat Terintegrasi 1 Kabupaten Gresik','2026-08',3759000.00,0.00,0.00,3759000.00,'2106956064','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(39,'263','UDI YATMINI','Cleaning Service','1 September 2026','3578134804760002','JAWA TIMUR','Sekolah Rakyat Terintegrasi 1 Kabupaten Gresik','2026-08',3759000.00,0.00,0.00,3759000.00,'2106956177','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(40,'264','UMANIYAH','Cleaning Service','1 September 2026','3525095412900002','JAWA TIMUR','Sekolah Rakyat Terintegrasi 1 Kabupaten Gresik','2026-08',3759000.00,0.00,0.00,3759000.00,'2106956199','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(41,'472','KUSMA WATIB','Cleaning Service','15 September 2026','6210045002860002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Gunung Mas','2026-08',3683000.00,0.00,0.00,3683000.00,'2106956100','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(42,'473','AYU KAROLINA','Juru Masak','15 September 2026','6210034604940002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Gunung Mas','2026-08',3683000.00,0.00,0.00,3683000.00,'2106956202','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(43,'474','MEGA FRANSISKA NATALIA','Juru Masak','13 September 2026','6210024202990002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Gunung Mas','2026-08',3683000.00,0.00,0.00,3683000.00,'2106956133','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(44,'550','ABNER RADJAKORE','Cleaning service','31 Agustus','8203071601821000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'2106956144','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(45,'551','DEKI RAANGE','Cleaning service','31 Agustus','8203200405950000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'2106956086','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(46,'552','DESSY ATTY','Cleaning service','31 Agustus','8201096412870000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'2106956097','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(47,'553','HERCO MEYER','Cleaning service','31 Agustus','8203140208910000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'2106956053','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(48,'564','AFNI UTARI A. TAHER GUSTI','Wali Asuh','31 Agustus','8203055411970000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'660201000502527','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(49,'580','SUSANTO SURIYANDARU','Wali Asuh','31 Agustus','8203150102960000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'1800012345536','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(50,'581','VANESIA WISE ULA-ULA','Wali Asuh','31 Agustus','8203204710030000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 1 Kabupaten Halmahera Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'007701149871509','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(51,'158','YULI MARGARENI','Juru Masak','28 juli','3212154910810004','JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Indramayu','2026-08',3433000.00,0.00,0.00,3433000.00,'1800004998516','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(52,'159','NURUR TIA OCTAVIANI','Juru Masak','23 agustus','3212116010050002','JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Indramayu','2026-08',3433000.00,0.00,0.00,3433000.00,'1800012346849','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(53,'184','NURUR TIA OKTAVIANI','Juru Masak','23 Agustus 2026',NULL,'JAWA BARAT','Sekolah Rakyat Terintegrasi 1 Kabupaten Indramayu','2026-08',3433000.00,0.00,0.00,3433000.00,'0740798765','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(54,'245','SHEILA SEVTIANA','Wali Asuh','31 Juli','3320094109010002','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Jepara','2026-08',2230000.00,0.00,0.00,2230000.00,'1390025824677','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(55,'484','SITI NADILA','Wali Asrama','16 Juli 2026','udh chat','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Katingan','2026-08',3683000.00,0.00,0.00,3683000.00,'3151606553','BCA','2026-10-07 00:31:42','2026-10-07 00:31:42'),(56,'478','AHMAD KHAPI','Wali Asuh','28 juli','6206100508980002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Kotawaringin Timur','2026-08',3683000.00,0.00,0.00,3683000.00,'1318761720','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(57,'479','AISYA KINANTI PUTRI','Wali Asuh','28 juli','6202066905020002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Kotawaringin Timur','2026-08',3683000.00,0.00,0.00,3683000.00,'14201042351500','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(58,'480','M. KAHFI','Wali Asuh','28 juli','6202050706010002','KALIMANTAN TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Kotawaringin Timur','2026-08',3683000.00,0.00,0.00,3683000.00,'014201052617506','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(59,'616','LEWI SALEMAN','Wali Asuh','22 Juli 2026','5305063011840001','NTT','Sekolah Rakyat Terintegrasi 1 Kabupaten Kupang','2026-08',2469000.00,0.00,0.00,2469000.00,'603701006135507','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(60,'617','RIDMIATI THALI KANA HAWU','Wali Asuh','24 Juli 2026',NULL,'NTT','Sekolah Rakyat Terintegrasi 1 Kabupaten Kupang','2026-08',2469000.00,0.00,0.00,2469000.00,'2098199007','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(61,'618','WILSON MATSALIR RATU UDJU','Wali Asuh','22 Juli 2026','5371042311960002','NTT','Sekolah Rakyat Terintegrasi 1 Kabupaten Kupang','2026-08',2469000.00,0.00,0.00,2469000.00,'2098393515','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(62,'582','AKHMAD PENDI SAPUTRA','Cleaning Service','20 September 2026','5208021508020001','NTB','Sekolah Rakyat Terintegrasi 1 Kabupaten Lombok Utara','2026-08',2760000.00,0.00,0.00,2760000.00,'2097700845','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(63,'583','AKHMAZ GAZALI','Cleaning Service','20 September 2026','5201090107970079','NTB','Sekolah Rakyat Terintegrasi 1 Kabupaten Lombok Utara','2026-08',2760000.00,0.00,0.00,2760000.00,'2098476572','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(64,'584','ANDRE TEGUH IMAMI','Cleaning Service','20 September 2026','5208020711900001','NTB','Sekolah Rakyat Terintegrasi 1 Kabupaten Lombok Utara','2026-08',2760000.00,0.00,0.00,2760000.00,'2098397225','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(65,'585','APIK SARIP SALL SAPUTRA','Cleaning Service','20 September 2026','5208012504080002','NTB','Sekolah Rakyat Terintegrasi 1 Kabupaten Lombok Utara','2026-08',2760000.00,0.00,0.00,2760000.00,'1851247341','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(66,'595','SARTIKAH','Cleaning Service','20 September 2026','5208037112740179','NTB','Sekolah Rakyat Terintegrasi 1 Kabupaten Lombok Utara','2026-08',2760000.00,0.00,0.00,2760000.00,'2098331285','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(67,'265','REGIAN SYAH NUARI','Cleaning Service','11 juli','3519070701030002','JAWA TIMUR','Sekolah Rakyat Terintegrasi 1 Kabupaten Madiun','2026-08',3759000.00,0.00,0.00,3759000.00,'423501003191508','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(68,'512','HERTES REMMONA','Cleaning Service','18 Agustus 2026',NULL,'MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2101495110','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(69,'513','NURHASANAH SAHERTIRA','Wali Asuh','18 Agustus 2026',NULL,'MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2102849716','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(70,'514','RAHMAT SIDIQ LATUQONSINA','Wali Asuh','18 Agustus 2026',NULL,'MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2102113607','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(71,'515','ARIF TUHETERU','Cleaning Service','18 agustus','8101061402850001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'1730016049034','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(72,'516','FATIMA','Cleaning Service','18 agustus','8101011305810003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2103141191','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(73,'517','HADIJA SARLUF','Cleaning Service','18 agustus','8101176110870003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2095188453','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(74,'518','HERTES REMONA','Cleaning Service','18 agustus','8101022806980002','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'0975173984','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(75,'519','MUNISA','Cleaning Service','18 agustus','8101014904770001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'1341762478','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(76,'520','ABDUL RAHMAN SILAWANE','Juru Masak','18 agustus','8101110806900002','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2103125351','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(77,'521','AHMAD ALDI SANAKY','Juru Masak','18 agustus','8101120306030002','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2101591573','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(78,'522','JAIS TEHUAYO','Juru Masak','18 agustus','8101112602900001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2098650020','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(79,'523','YUSUF TIHURUA','Juru Masak','18 agustus','8101012804000001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(80,'524','HERU DANDI HASIM','Wali Asrama','18 agustus','8101171101020002','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2112021328','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(81,'525','ODE HADIJAH','Wali Asrama','18 agustus','8101174605980003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(82,'526','SALMA SELEHULANO','Wali Asrama','18 agustus','8171024306880003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,NULL,NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(83,'527','SANTI NAMAKULE','Wali Asrama','18 agustus','8101115211010003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:31:42'),(84,'528','NURHASANAH SAHARTIRA','Wali Asuh','18 agustus','8101174205020004','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2100871902','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(85,'529','ODE ABDU RAHIM','Wali Asuh','18 agustus','8101172605900002','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2098554100','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(86,'530','RAHMAT SIDIQ LATUCONSINA','Wali Asuh','18 agustus','8101171212970001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2099855968','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(87,'531','HALIJA KAPLALE','Juru Masak','3 Agustus','8101014704010003','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'480001044394532','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(88,'532','INDRA ELY','Wali Asuh','18 agustus','8106021907970001','MALUKU','Sekolah Rakyat Terintegrasi 1 Kabupaten Maluku Tengah','2026-08',3268000.00,0.00,0.00,3268000.00,'2107332624','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(89,'629','MIFTA FADILLA PUTRI','Juru Masak','8 agustus','6474015707950008','SULAWESI SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Soppeng','2026-08',3877000.00,0.00,0.00,3877000.00,'2106956075','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(90,'219','ARGA WAHYU ISWANTO','Wali Asuh','1 September 2026','3311092809890001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Sukoharjo','2026-08',2230000.00,0.00,0.00,2230000.00,'-',NULL,'2026-10-07 00:31:42','2026-10-07 00:49:17'),(91,'220','BONAR SAMBODO','Wali Asuh','1 September 2026','3311061109950004','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Sukoharjo','2026-08',2230000.00,0.00,0.00,2230000.00,'2106956064','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(92,'221','HARTONO','Wali Asuh','1 September 2026','3311040402870003','JAWA TENGAH','Sekolah Rakyat Terintegrasi 1 Kabupaten Sukoharjo','2026-08',2230000.00,0.00,0.00,2230000.00,'2106956177','BNI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(93,'633','HASMIAH','Wali Asuh','29 Juli 2026','7305036804960002','SULAWESI SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Takalar','2026-08',3877000.00,0.00,0.00,3877000.00,'2106956199','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(94,'634','ILMIAH HIDAYAH','Wali Asuh','29 Juli 2026','7305036308920001','SULAWESI SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Takalar','2026-08',3877000.00,0.00,0.00,3877000.00,'2106956100','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(95,'448','SUGIARTO','Wali Asuh','15 Agustus','6310091005950002','KALIMANTAN SELATAN','Sekolah Rakyat Terintegrasi 1 Kabupaten Tanah Bumbu','2026-08',3706000.00,0.00,0.00,3706000.00,'2106956202','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(96,'417','SYF. NURHAYATI','Cleaning Service','27 Juli 2026','6171046103890006','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Pontianak','2026-08',3061000.00,0.00,0.00,3061000.00,'2106956133','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(97,'418','EKA HASNA BAITI','Juru Masak','27 Juli 2026',NULL,'KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Pontianak','2026-08',3061000.00,0.00,0.00,3061000.00,'2106956144','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(98,'419','SY. RADIA','Juru Masak','27 Juli 2026',NULL,'KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Pontianak','2026-08',3061000.00,0.00,0.00,3061000.00,'2106956086','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(99,'420','SYF. NURMALA','Juru Masak','27 Juli 2026',NULL,'KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Pontianak','2026-08',3061000.00,0.00,0.00,3061000.00,'2106956097','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(100,'421','NURANISA','Operator Data Sekolah','27 Juli 2026',NULL,'KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Pontianak','2026-08',3061000.00,0.00,0.00,3061000.00,'2106956053','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(101,'394','AZZAHRA','Wali Asrama','31 Agustus','6172025310030002','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'660201000502527','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(102,'395','DJATI MAHARDIKA','Wali Asrama','31 Agustus','6172020803000001','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'1800012345536','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(103,'396','RISKA AULIYAH','Wali Asrama','31 Agustus','6103124808980001','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'007701149871509','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(104,'397','ADITTYA THERESKOVA','Wali Asuh','31 Agustus','6172035711010002','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'1800004998516','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(105,'398','AFIFAH NURIZZATI','Wali Asuh','31 Agustus','6172017110980003','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'1800012346849','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(106,'399','APRIANA TING TING','Wali Asuh','31 Agustus','6172055105970002','KALIMANTAN BARAT','Sekolah Rakyat Terintegrasi 2 Kota Singkawang','2026-08',3061000.00,0.00,0.00,3061000.00,'0740798765','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(107,'95','I MADE DARMAWAN','Cleaning Service','1 September 2026','5107083112890122','BALI','Sekolah Rakyat Terintegrasi 3 Provinsi Bali','2026-08',3177000.00,0.00,0.00,3177000.00,'1390025824677','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:49:17'),(108,'535','ASMITA BASIR','Wali Asuh','1 Agustus 2026','8201054906990003','MALUKU UTARA','Sekolah Rakyat Terintegrasi 3 Provinsi Maluku Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'3151606553','BCA','2026-10-07 00:31:42','2026-10-07 00:31:42'),(109,'536','JULKIFLI BASRI','Wali Asuh','16 Agustus','8271060107890000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 3 Provinsi Maluku Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'1318761720','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(110,'537','RIZAL SAIFUL','Wali Asuh','16 Agustus','8201050504970000','MALUKU UTARA','Sekolah Rakyat Terintegrasi 3 Provinsi Maluku Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'14201042351500','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(111,'538','SOFYAN FAHRI','Wali Asuh','16 Agustus','8201051909980003','MALUKU UTARA','Sekolah Rakyat Terintegrasi 3 Provinsi Maluku Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'014201052617506','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(112,'539','FITRIA, A, SALAM','Cleaning Service','29 Juli 2026','8272025101950001','MALUKU UTARA','Sekolah Rakyat Terintegrasi 3 Provinsi Maluku Utara','2026-08',3495000.00,0.00,0.00,3495000.00,'603701006135507','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(113,'224','ILHAM SAPUTRA','Wali Asuh',NULL,'3320022103000002','JAWA TENGAH','Sekolah Rakyat Terintegrasi 45 Semarang','2026-08',2230000.00,0.00,0.00,2230000.00,'1800004998516','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(114,'225','KHUSNA SYAMILA','Wali Asuh',NULL,'3374144907030002','JAWA TENGAH','Sekolah Rakyat Terintegrasi 45 Semarang','2026-08',2230000.00,0.00,0.00,2230000.00,'1800012346849','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(115,'226','MOHAMMAD ULIL ALBAB','Juru Masak',NULL,'3315150405990001','JAWA TENGAH','Sekolah Rakyat Terintegrasi 45 Semarang','2026-08',2230000.00,0.00,0.00,2230000.00,'0740798766','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(116,'227','SUTARNO','Juru Masak',NULL,'3374150708610002','JAWA TENGAH','Sekolah Rakyat Terintegrasi 45 Semarang','2026-08',2230000.00,0.00,0.00,2230000.00,'1390025824677','MANDIRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(117,'170','DIAH NUR AZIZAH','Wali Asrama','27 juli 2026','3212214805030003','JAWA BARAT','SRT 1 KAB.INDRAMAYU','2026-08',3433000.00,0.00,0.00,3433000.00,'-514083113','BCA','2026-10-07 00:31:42','2026-10-07 00:31:42'),(118,'171','IKLIMAH','Wali Asuh','27 juli 2026','3212264209990001','JAWA BARAT','SRT 1 KAB.INDRAMAYU','2026-08',3433000.00,0.00,0.00,3433000.00,'-2346927946','BNI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(119,'172','KENDRI','Wali Asuh','27 juli 2026','3209295103970002','JAWA BARAT','SRT 1 KAB.INDRAMAYU','2026-08',3433000.00,0.00,0.00,3433000.00,'14201042351500','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(120,'173','MICHAEL LEONARDO','Wali Asuh','27 juli 2026','3212122005910002','JAWA BARAT','SRT 1 KAB.INDRAMAYU','2026-08',3433000.00,0.00,0.00,3433000.00,'014201052617506','BRI','2026-10-07 00:31:42','2026-10-07 00:31:42'),(121,NULL,'Budi Santoso',NULL,NULL,'3171011508890001','DKI Jakarta',NULL,'2026-03',8500000.00,2000000.00,450000.00,10050000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(122,NULL,'Siti Rahmawati',NULL,NULL,'3273022204920003','Jawa Barat',NULL,'2026-03',6200000.00,1200000.00,300000.00,7100000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(123,NULL,'Agus Setiawan',NULL,NULL,'3374031901850002','Jawa Tengah',NULL,'2026-03',5400000.00,950000.00,220000.00,6130000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(124,NULL,'Dewi Lestari',NULL,NULL,'3578041112950004','Jawa Timur',NULL,'2026-03',7100000.00,1600000.00,380000.00,8320000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(125,NULL,'Fajar Pratama',NULL,NULL,'3671052309900005','Banten',NULL,'2026-03',6800000.00,1400000.00,320000.00,7880000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(126,NULL,'Anisa Kusuma',NULL,NULL,'3471060407940006','DI Yogyakarta',NULL,'2026-03',5200000.00,800000.00,200000.00,5800000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(127,NULL,'I Made Wijaya',NULL,NULL,'5171071803880007','Bali',NULL,'2026-03',7500000.00,1750000.00,410000.00,8840000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(128,NULL,'Rahmat Hidayat',NULL,NULL,'1271082905910008','Sumatera Utara',NULL,'2026-03',6400000.00,1100000.00,280000.00,7220000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(129,NULL,'Putri Ayu Handayani',NULL,NULL,'6471091408930009','Kalimantan Timur',NULL,'2026-03',9000000.00,2500000.00,550000.00,10950000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(130,NULL,'Muhammad Iqbal',NULL,NULL,'7371100511870010','Sulawesi Selatan',NULL,'2026-03',6900000.00,1350000.00,310000.00,7940000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(131,NULL,'Eka Saputra',NULL,NULL,'3172010802900011','DKI Jakarta',NULL,'2026-03',11000000.00,3000000.00,750000.00,13250000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08'),(132,NULL,'Nurmala Sari',NULL,NULL,'3271021406930012','Jawa Barat',NULL,'2026-03',5800000.00,900000.00,250000.00,6450000.00,NULL,NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08');
/*!40000 ALTER TABLE `payrolls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (2,'App\\Models\\User',26,'auth_token','6959893db7b0fb2957ba106212521fefdbd095ed05891ba1546601a6e939ce69','[\"*\"]',NULL,NULL,'2026-10-07 00:31:52','2026-10-07 00:31:52'),(3,'App\\Models\\User',27,'auth_token','2b16115895d3a14b501cdcd86df1ba8a86ccf736e7a3a1b396d3e1a977619c73','[\"*\"]',NULL,NULL,'2026-10-07 00:32:04','2026-10-07 00:32:04'),(4,'App\\Models\\User',26,'auth_token','5ffddc00ff23ae4911580f5c21834755ca626d40cf5133a8a0931541d5a55763','[\"*\"]','2026-10-07 01:00:23',NULL,'2026-10-07 00:34:06','2026-10-07 01:00:23'),(9,'App\\Models\\User',26,'auth_token','091ecac4f7c0b25f40f7c4706288d7bdcc3d8299e3cc8df357101d23f803b332','[\"*\"]','2026-10-07 01:32:25',NULL,'2026-10-07 01:21:30','2026-10-07 01:32:25');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (26,'Administrator HR','admin@payrollhub.com',NULL,'$2y$12$irujN/P39l9nyyKYy8Dl/er8ohmWtXcxT/DHtKUu1unW4598Jb4Yq','admin',NULL,'2026-10-07 00:31:41','2026-10-07 01:13:08'),(27,'Viewer Penggajian','viewer@payrollhub.com',NULL,'$2y$12$YrnDLXJRWCRjarUnX5YWuexSSfkl0EP92/iHCNxzHyA/OkdceRtDq','user',NULL,'2026-10-07 00:31:41','2026-10-07 01:13:08'),(28,'Staf HR & Manajemen','user@payrollhub.com',NULL,'$2y$12$/6UQ9D0MzsZzwjW2xKVzmevSyWq9pyu0SrbWeaBQrJIF2KhtSRhWO','user',NULL,'2026-10-07 01:13:08','2026-10-07 01:13:08');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-07 16:58:19
