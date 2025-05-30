import express from 'express';
import metadataRouter from "../features/metadata/metadata.route.js";
import queryRouter from '../features/queryx/query.route.js'

const router = express.Router();

// Placeholder test route
router.get('/', (req, res) => {
  res.json({ message: 'API is running!' });
});

// Mount the metadata router
router.use('/metadata', metadataRouter);
router.use('/query', queryRouter);

export default router;
