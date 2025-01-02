export const flattenTeam = (payload: any) => {
  return {
    _id: payload._id,
    name: payload.name,
    color: payload.color,
  };
};
