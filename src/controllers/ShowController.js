// Import the neccesary modules.
import Show from '../models/Show';
import { pageSize } from '../config/constants';

/** Class for getting show data from the MongoDB. */
export default class ShowController {

  /**
   * Object to search for shows.
   * @type {Object}
   */
  static query = {
    num_seasons: {
      $gt: 0
    }
  };

  /**
   * Object used for the projections of shows.
   * @type {Object}
   */
  static _projections = {
    _id: 1,
    imdb_id: 1,
    tvdb_id: 1,
    title: 1,
    year: 1,
    slug: 1,
    genres: 1,
    images: 1,
    rating: 1,
    num_seasons: 1
  };

  /**
   * Get all the pages.
   * @param {Request} req - The express request object.
   * @param {Response} res - The express response object.
   * @param {Function} next - The next function for Express.
   * @returns {String[]} - A list of pages which are available.
   */
  getShows(req, res, next) {
    return Show.count(ShowController.query).exec().then(count => {
      const pages = Math.ceil(count / pageSize);
      const docs = [];

      for (let i = 1; i < pages + 1; i++) docs.push(`shows/${i}`); // eslint-disable-line semi-spacing

      return res.json(docs);
    }).catch(err => next(err));
  }

  /**
   * Get one page.
   * @param {Request} req - The express request object.
   * @param {Response} res - The express response object.
   * @param {Function} next - The next function for Express.
   * @returns {Show[]} - The contents of one page.
   */
  getPage(req, res, next) {
    const page = req.params.page - 1;
    const offset = page * pageSize;

    if (req.params.page.match(/all/i)) {
      return Show.aggregate([{
        $match: ShowController.query
      }, {
        $project: ShowController._projections
      }, {
        $sort: {
          title: -1
        }
      }]).exec()
        .then(docs => res.json(docs))
        .catch(err => next(err));
    }

    const query = Object.assign({}, ShowController.query);
    const data = req.query;

    data.order = data.order ? parseInt(data.order, 10) : -1;

    let sort = {
      'rating.votes': data.order,
      'rating.percentage': data.order,
      'rating.watching': data.order
    };

    if (data.keywords) {
      const words = data.keywords.split(' ');
      let regex = '^';

      for (const w in words) {
        words[w] = words[w].replace(/[^a-zA-Z0-9]/g, '');
        regex += `(?=.*\\b${RegExp.escape(words[w].toLowerCase())}\\b)`;
      }

      query.title = {
        $regex: new RegExp(`${regex}.*`),
        $options: 'gi'
      };
    }

    if (data.sort) {
      if (data.sort.match(/name/i)) sort = {
        title: data.order
      };
      if (data.sort.match(/rating/i)) sort = {
        'rating.percentage': data.order,
        'rating.votes': data.order
      };
      if (data.sort.match(/trending/i)) sort = {
        'rating.watching': data.order
      };
      if (data.sort.match(/updated/i)) sort = {
        latest_episode: data.order
      };
      if (data.sort.match(/year/i)) sort = {
        year: data.order
      };
    }

    if (data.genre && !data.genre.match(/all/i)) {
      // TODO: bit of a hack, should be handled by the client.
      let { genre } = data;
      if (genre.match(/science[-\s]fiction/i) || genre.match(/sci[-\s]fi/i))
        genre = 'science-fiction';

      query.genres = genre.toLowerCase();
    }

    return Show.aggregate([{
      $sort: sort
    }, {
      $match: query
    }, {
      $project: ShowController._projections
    }, {
      $skip: offset
    }, {
      $limit: pageSize
    }]).exec()
      .then(docs => res.json(docs))
      .catch(err => res.jfson(err));
  }

  /**
   * Get info from one show.
   * @param {Request} req - The express request object.
   * @param {Response} res - The express response object.
   * @param {Function} next - The next function for Express.
   * @returns {Show} - The details of a single show.
   */
  getShow(req, res, next) {
    return Show.findOne({
      _id: req.params.id
    }, {
      latest_episode: 0
    }).exec()
      .then(docs => res.json(docs))
      .catch(err => next(err));
  }

  /**
   * Get a random show.
   * @param {Request} req - The express request object.
   * @param {Response} res - The express response object.
   * @param {Function} next - The next function for Express.
   * @returns {Show} - A random show.
   */
  getRandomShow(req, res, next) {
    return Show.aggregate([{
      $sample: {
        size: 1
      }
    }, {
      $limit: 1
    }]).exec()
      .then(docs => res.json(docs[0]))
      .catch(err => next(err));
  }

}
